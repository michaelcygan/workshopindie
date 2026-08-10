import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createHash } from "crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { domainError } from "@/lib/errors";

async function requireAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw domainError("FORBIDDEN", "Forbidden: admin only");
}

function clientIpHash(): string | null {
  const raw =
    getRequestHeader("cf-connecting-ip") ||
    getRequestHeader("x-real-ip") ||
    getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
    "";
  if (!raw) return null;
  const salt = new Date().toISOString().slice(0, 10);
  return createHash("sha256").update(`${raw}::${salt}::newsletter`).digest("hex");
}

// In-memory bucket (Worker instance scoped) as a soft-fast cap; the DB check below is authoritative.
const softCounts = new Map<string, { count: number; ts: number }>();

const subscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  website: z.string().max(200).optional().default(""), // honeypot
  source: z.string().trim().max(40).optional(),
});

export const subscribeToNewsletter = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => subscribeSchema.parse(d))
  .handler(async ({ data }) => {
    // Honeypot: silently succeed (bots get no signal).
    if (data.website && data.website.trim().length > 0) return { ok: true };

    const ip = clientIpHash();
    if (ip) {
      // Soft in-memory rate limit: 5 per instance per 10 min per ip-hash.
      const now = Date.now();
      const cur = softCounts.get(ip);
      if (!cur || now - cur.ts > 10 * 60 * 1000) {
        softCounts.set(ip, { count: 1, ts: now });
      } else {
        cur.count++;
        if (cur.count > 5) return { ok: true };
      }
    }

    const { upsertNewsletterSubscriber } = await import("@/lib/newsletter.server");
    await upsertNewsletterSubscriber(data.email, data.source?.trim() || "footer");


    return { ok: true };
  });

export const adminListSubscribers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data, error } = await supabaseAdmin
      .from("newsletter_subscribers")
      .select("id,email,status,source,subscribed_at,unsubscribed_at,created_at")
      .order("subscribed_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);
    const total = data?.length ?? 0;
    const active = (data ?? []).filter((r) => r.status === "subscribed").length;
    return { rows: data ?? [], total, active };
  });

export const adminExportSubscribersCsv = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { source?: string } | undefined) =>
    z.object({ source: z.string().max(60).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data: input, context }) => {
    await requireAdmin(context.supabase, context.userId);
    let q = supabaseAdmin
      .from("newsletter_subscribers")
      .select("email,subscribed_at,source")
      .eq("status", "subscribed");
    if (input.source) q = q.eq("source", input.source);
    const { data, error } = await q.order("subscribed_at", { ascending: false });
    if (error) throw new Error(error.message);

    const lines = ["email,subscribed_at,source"];
    for (const r of data ?? []) {
      const esc = (s: string) => `"${(s ?? "").replace(/"/g, '""')}"`;
      lines.push([esc(r.email), esc(r.subscribed_at ?? ""), esc(r.source ?? "")].join(","));
    }
    return { csv: lines.join("\n") };
  });

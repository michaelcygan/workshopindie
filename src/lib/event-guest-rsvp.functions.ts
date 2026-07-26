import { createServerFn, getRequest } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createHash } from "crypto";
import { moderateOrThrow } from "./moderation/service.server";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export const submitGuestEventRsvp = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({
      eventId: z.string().uuid(),
      name: z.string().min(1).max(80),
      email: z.string().email().max(255),
      note: z.string().max(280).optional().nullable(),
      status: z.enum(["going", "maybe", "declined"]).default("going"),
    }).parse(i)
  )
  .handler(async ({ data }) => {
    await moderateOrThrow({ userId: null, surface: "event_guest_rsvp", text: data.name });
    if (data.note) await moderateOrThrow({ userId: null, surface: "event_guest_rsvp", text: data.note });
    const request = getRequest();
    const supabase = publicClient();
    const claimToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null;
    const userAgent = request.headers.get("user-agent") ?? null;
    const { data: row, error } = await supabase
      .from("event_guest_rsvps")
      .insert({
        event_id: data.eventId,
        name: data.name,
        email: data.email.toLowerCase(),
        note: data.note,
        status: data.status,
        ip_hash: hashIp(ip),
        user_agent: userAgent,
        claim_token: claimToken,
        claim_token_expires_at: expiresAt,
      })
      .select("claim_token, claim_token_expires_at, status")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const claimGuestEventRsvp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ claimToken: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { data: rsvp, error: fetchErr } = await supabase
      .from("event_guest_rsvps")
      .select("id, event_id, status, matched_user_id, claim_token_expires_at")
      .eq("claim_token", data.claimToken)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!rsvp) throw new Error("RSVP not found");
    if (rsvp.claim_token_expires_at && new Date(rsvp.claim_token_expires_at) < new Date()) {
      throw new Error("Claim link has expired");
    }
    if (rsvp.matched_user_id && rsvp.matched_user_id !== context.userId) {
      throw new Error("Claim link already used by another account");
    }
    const { error: updateErr } = await supabase
      .from("event_guest_rsvps")
      .update({ matched_user_id: context.userId, matched_at: new Date().toISOString() })
      .eq("id", rsvp.id);
    if (updateErr) throw new Error(updateErr.message);
    const { error: rsvpErr } = await supabase
      .from("group_event_rsvps")
      .upsert({
        event_id: rsvp.event_id,
        user_id: context.userId,
        status: rsvp.status,
        source: "guest_claim",
      }, { onConflict: "event_id, user_id" });
    if (rsvpErr) throw new Error(rsvpErr.message);
    return { event_id: rsvp.event_id };
  });

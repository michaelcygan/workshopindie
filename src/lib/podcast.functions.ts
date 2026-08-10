import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createHash } from "crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { domainError } from "@/lib/errors";
import { normalizeUrl } from "@/lib/url-normalize";
import { isFieldId } from "@/lib/taxonomy";

export const PODCAST_STATUSES = [
  "new",
  "reviewing",
  "shortlisted",
  "invited",
  "recorded",
  "declined",
  "archived",
] as const;
export type PodcastStatus = (typeof PODCAST_STATUSES)[number];

export const PODCAST_STATUS_LABELS: Record<PodcastStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  shortlisted: "Shortlisted",
  invited: "Invited",
  recorded: "Recorded",
  declined: "Declined",
  archived: "Archived",
};

export type PodcastApplication = {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  field: string;
  specialization: string | null;
  portfolio_url: string;
  social_handle: string | null;
  city: string | null;
  city_id: string | null;
  workshop_username: string | null;
  wants_account: boolean;
  process_description: string;
  current_work: string | null;
  conversation_topics: string | null;
  marketing_opt_in: boolean;
  status: PodcastStatus;
  internal_notes: string | null;
  created_at: string;
};


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
  return createHash("sha256").update(`${raw}::${salt}::podcast`).digest("hex");
}
/**
 * Accepts a full Workshop profile URL or a bare handle and returns the
 * normalized username. Anything unusable becomes null — this field is a
 * convenience, never a validation gate on the application.
 */
function parseWorkshopUsername(raw: string | null): string | null {
  if (!raw) return null;
  let s = raw.trim();
  const m = s.match(/^(?:https?:\/\/)?(?:www\.)?workshopindie\.com\/(.+)$/i);
  if (m?.[1]) s = m[1];
  s = s.split(/[?#]/)[0] ?? "";
  s = s.replace(/\/+$/, "");
  const last = s.split("/").filter(Boolean).pop() ?? "";
  const username = normalizeUsername(last.replace(/^@/, ""));
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) return null;
  return username;
}


const optionalLine = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length ? v : null));

const applicationSchema = z.object({
  name: z.string().trim().min(1, "Please add your name.").max(120),
  email: z.string().trim().toLowerCase().email("Please enter a valid email.").max(255),
  field: z.string().trim().refine(isFieldId, "Please choose a field."),
  specialization: optionalLine(120),
  portfolioUrl: z.string().trim().min(1, "Please add a link to your work.").max(500),
  socialHandle: optionalLine(120),
  city: optionalLine(120),
  cityId: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  workshopUrl: optionalLine(200),
  wantsAccount: z.boolean().optional().default(false),

  processDescription: z
    .string()
    .trim()
    .min(40, "Tell us a little more about how you work.")
    .max(4000),
  currentWork: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v && v.length ? v : null)),
  conversationTopics: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v && v.length ? v : null)),
  marketingOptIn: z.boolean().optional().default(false),
  website: z.string().max(200).optional().default(""), // honeypot
});

export const submitPodcastApplication = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => applicationSchema.parse(d))
  .handler(async ({ data }) => {
    // Honeypot: silently succeed (bots get no signal).
    if (data.website && data.website.trim().length > 0) return { ok: true };

    const portfolioUrl = normalizeUrl(data.portfolioUrl);
    if (!portfolioUrl) {
      throw domainError("INVALID_INPUT", "That link doesn't look like a valid URL.");
    }

    const ip = clientIpHash();
    if (ip) {
      const { data: ok } = await supabaseAdmin.rpc("check_and_bump", {
        _action: "podcast_application",
        _key: ip,
        _window_s: 3600,
        _max: 5,
      });
      if (ok === false) {
        throw domainError(
          "RATE_LIMITED",
          "You've submitted a few applications already. Please try again later.",
        );
      }
    }

    // Attach the Workshop account when the visitor happens to be signed in.
    let userId: string | null = null;
    const authHeader = getRequestHeader("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const { data: claims } = await supabaseAdmin.auth.getClaims(
        authHeader.replace("Bearer ", ""),
      );
      userId = (claims?.claims?.sub as string | undefined) ?? null;
    }

    const { moderateOrThrow } = await import("@/lib/moderation/service.server");
    for (const text of [
      data.name,
      data.specialization,
      data.processDescription,
      data.currentWork,
      data.conversationTopics,
    ]) {
      await moderateOrThrow({
        userId,
        surface: "podcast_application",
        text,
      });
    }

    const { error } = await supabaseAdmin.from("podcast_applications").insert({
      user_id: userId,
      name: data.name,
      email: data.email,
      field: data.field,
      specialization: data.specialization,
      portfolio_url: portfolioUrl,
      social_handle: data.socialHandle,
      city: data.city,
      city_id: data.cityId,
      workshop_username: parseWorkshopUsername(data.workshopUrl),
      wants_account: !!data.wantsAccount,
      process_description: data.processDescription,
      current_work: data.currentWork,
      conversation_topics: data.conversationTopics,
      marketing_opt_in: !!data.marketingOptIn,
    });

    if (error) throw new Error(error.message);

    if (data.marketingOptIn) {
      const { upsertNewsletterSubscriber } = await import("@/lib/newsletter.server");
      try {
        await upsertNewsletterSubscriber(data.email, "podcast_application");
      } catch {
        // The application is the primary record; never fail on list signup.
      }
    }

    return { ok: true };
  });

export const adminListPodcastApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data, error } = await supabaseAdmin
      .from("podcast_applications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as PodcastApplication[];
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;

    const ids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[];
    let usernames: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id,username")
        .in("id", ids);
      usernames = Object.fromEntries(
        (profs ?? []).filter((p) => p.username).map((p) => [p.id, p.username as string]),
      );
    }

    return { rows, counts, total: rows.length, usernames };
  });

export const adminUpdatePodcastApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status?: string; internalNotes?: string | null }) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(PODCAST_STATUSES).optional(),
        internalNotes: z.string().max(4000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const patch: { status?: PodcastStatus; internal_notes?: string | null } = {};
    if (data.status) patch.status = data.status;
    if (data.internalNotes !== undefined) {
      patch.internal_notes = data.internalNotes?.trim() || null;
    }

    if (!Object.keys(patch).length) return { ok: true };

    const { error } = await supabaseAdmin
      .from("podcast_applications")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

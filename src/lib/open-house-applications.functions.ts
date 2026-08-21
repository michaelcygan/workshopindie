import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createHash } from "crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { domainError } from "@/lib/errors";
import { normalizeUrl } from "@/lib/url-normalize";
import { normalizeUsername, USERNAME_MIN, USERNAME_MAX } from "@/lib/usernames";
import { parseFriendly } from "@/lib/zod-message";
import {
  LENGTH_IDS,
  OPEN_HOUSE_STATUSES,
  PARTNER_TYPE_IDS,
  PERFORMANCE_SUBTYPE_IDS,
  PROPOSAL_MAX,
  PROPOSAL_MIN,
  type OpenHouseApplication,
  type OpenHouseStatus,
} from "@/lib/open-house";

/**
 * Open House programming intake. This is a private roster of people Workshop
 * may invite to a future Open House — it never touches Events, lineups, RSVPs,
 * or venues. Modeled directly on the podcast application funnel.
 */

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
  return createHash("sha256").update(`${raw}::${salt}::open_house`).digest("hex");
}

/**
 * Accepts a full Workshop profile URL or a bare handle and returns the
 * normalized username. Anything unusable becomes null — a convenience field,
 * never a validation gate on the application.
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
  contactName: z.string().trim().min(1, "Please add your name.").max(120),
  projectName: optionalLine(140),
  email: z.string().trim().toLowerCase().email("Please enter a valid email.").max(255),
  programType: z.enum(PROGRAM_TYPE_IDS, { message: "Please choose what you'd like to do." }),
  city: z.string().trim().min(1, "Please tell us where you're based.").max(160),
  cityId: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  portfolioUrl: z.string().trim().min(1, "Please add a link to your work.").max(500),
  workshopUrl: optionalLine(200),
  proposal: z
    .string()
    .trim()
    .min(PROPOSAL_MIN, "Tell us a little more about what you'd like to bring.")
    .max(PROPOSAL_MAX),
  approximateLength: z
    .enum(LENGTH_IDS)
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  setupNeeds: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v && v.length ? v : null)),
  marketingOptIn: z.boolean().optional().default(false),
  wantsAccount: z.boolean().optional().default(false),
  website: z.string().max(200).optional().default(""), // honeypot
});

export const submitOpenHouseApplication = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    parseFriendly(applicationSchema, d, {
      contactName: "Your name",
      email: "Email",
      programType: "What you'd like to do",
      city: "Where you're based",
      portfolioUrl: "Link to your work",
      proposal: "Your proposal",
    }),
  )
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
        _action: "open_house_application",
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
    for (const text of [data.contactName, data.projectName, data.proposal, data.setupNeeds]) {
      await moderateOrThrow({ userId, surface: "open_house_application", text });
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("open_house_applications")
      .insert({
        user_id: userId,
        contact_name: data.contactName,
        project_name: data.projectName,
        email: data.email,
        program_type: data.programType,
        city: data.city,
        city_id: data.cityId,
        portfolio_url: portfolioUrl,
        workshop_username: parseWorkshopUsername(data.workshopUrl),
        proposal: data.proposal,
        approximate_length: data.approximateLength,
        setup_needs: data.setupNeeds,
        marketing_opt_in: !!data.marketingOptIn,
        wants_account: !!data.wantsAccount,
      })
      .select("id")
      .maybeSingle();

    if (error) throw new Error(error.message);

    // Ping every admin in the bell. Never let this break the submission.
    try {
      const { data: admins } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      const recipientIds = (admins ?? []).map((a) => a.user_id as string);
      if (recipientIds.length) {
        const { notifyMany } = await import("@/lib/notifications/deliver.server");
        await notifyMany({
          recipientIds,
          actorUserId: null,
          kind: "open_house_application_new",
          entityType: "open_house_application",
          entityId: inserted?.id ?? null,
          payload: {
            name: data.projectName || data.contactName,
            program_type: data.programType,
            city: data.city,
          },
          dedupeWindowS: 0,
          allowSelf: true,
        });
      }
    } catch (err) {
      console.error("[open-house] admin notify failed", err);
    }

    if (data.marketingOptIn) {
      const { upsertNewsletterSubscriber } = await import("@/lib/newsletter.server");
      try {
        await upsertNewsletterSubscriber(data.email, "open_house_application");
      } catch {
        // The application is the primary record; never fail on list signup.
      }
    }

    return { ok: true };
  });

export const adminListOpenHouseApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data, error } = await supabaseAdmin
      .from("open_house_applications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as OpenHouseApplication[];
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

export const adminUpdateOpenHouseApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status?: string; internalNotes?: string | null }) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(OPEN_HOUSE_STATUSES).optional(),
        internalNotes: z.string().max(4000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const patch: { status?: OpenHouseStatus; internal_notes?: string | null } = {};
    if (data.status) patch.status = data.status;
    if (data.internalNotes !== undefined) {
      patch.internal_notes = data.internalNotes?.trim() || null;
    }

    if (!Object.keys(patch).length) return { ok: true };

    const { error } = await supabaseAdmin
      .from("open_house_applications")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

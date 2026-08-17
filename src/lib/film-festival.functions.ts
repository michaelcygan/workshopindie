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
  FILM_FORMAT_IDS,
  FILM_STATUSES,
  LOGLINE_MAX,
  SYNOPSIS_MAX,
  SYNOPSIS_MIN,
  type FilmFestivalSubmission,
  type FilmStatus,
} from "@/lib/film-festival";

/**
 * Workshop Film Festival intake. A private roster of films Workshop may
 * program at future pop-up screenings — it never touches Events or venues.
 * Modeled directly on the Open House / podcast application funnels.
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
  return createHash("sha256").update(`${raw}::${salt}::film_festival`).digest("hex");
}

/** Accepts a full Workshop profile URL or a bare handle; unusable input is null. */
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

const submissionSchema = z.object({
  contactName: z.string().trim().min(1, "Please add your name.").max(120),
  email: z.string().trim().toLowerCase().email("Please enter a valid email.").max(255),
  filmTitle: z.string().trim().min(1, "Please add the film's title.").max(200),
  workshopUrl: optionalLine(200),
  city: z.string().trim().min(1, "Please tell us where you're based.").max(160),
  cityId: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  filmFormat: z.enum(FILM_FORMAT_IDS, { message: "Please choose a format." }),
  runtimeMinutes: z
    .number()
    .int()
    .min(1, "Please add the runtime in minutes.")
    .max(1000, "That runtime looks too long."),
  completionYear: z
    .number()
    .int()
    .min(1900)
    .max(2100)
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  trailerUrl: z.string().trim().min(1, "Please add a trailer link.").max(500),
  filmUrl: optionalLine(500),
  accessNotes: optionalLine(500),
  logline: z.string().trim().min(1, "Please add a one-line logline.").max(LOGLINE_MAX),
  synopsis: z
    .string()
    .trim()
    .min(SYNOPSIS_MIN, "Tell us a little more about the film.")
    .max(SYNOPSIS_MAX),
  credits: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v && v.length ? v : null)),
  rightsConfirmed: z.boolean(),
  marketingOptIn: z.boolean().optional().default(false),
  wantsAccount: z.boolean().optional().default(false),
  website: z.string().max(200).optional().default(""), // honeypot
});

export const submitFilmFestivalSubmission = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    parseFriendly(submissionSchema, d, {
      contactName: "Your name",
      email: "Email",
      filmTitle: "Film title",
      city: "Where you're based",
      filmFormat: "Format",
      runtimeMinutes: "Runtime",
      trailerUrl: "Trailer link",
      logline: "Logline",
      synopsis: "About the film",
    }),
  )
  .handler(async ({ data }) => {
    // Honeypot: silently succeed (bots get no signal).
    if (data.website && data.website.trim().length > 0) return { ok: true };

    if (!data.rightsConfirmed) {
      throw domainError(
        "INVALID_INPUT",
        "Please confirm you have the rights to have this film screened.",
      );
    }

    const trailerUrl = normalizeUrl(data.trailerUrl);
    if (!trailerUrl) {
      throw domainError("INVALID_INPUT", "That trailer link doesn't look like a valid URL.");
    }
    let filmUrl: string | null = null;
    if (data.filmUrl) {
      filmUrl = normalizeUrl(data.filmUrl);
      if (!filmUrl) {
        throw domainError("INVALID_INPUT", "That full film link doesn't look like a valid URL.");
      }
    }

    const ip = clientIpHash();
    if (ip) {
      const { data: ok } = await supabaseAdmin.rpc("check_and_bump", {
        _action: "film_festival_submission",
        _key: ip,
        _window_s: 3600,
        _max: 5,
      });
      if (ok === false) {
        throw domainError(
          "RATE_LIMITED",
          "You've submitted a few films already. Please try again later.",
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
      data.contactName,
      data.filmTitle,
      data.logline,
      data.synopsis,
      data.credits,
      data.accessNotes,
    ]) {
      await moderateOrThrow({ userId, surface: "film_festival_submission", text });
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("film_festival_submissions")
      .insert({
        user_id: userId,
        contact_name: data.contactName,
        email: data.email,
        film_title: data.filmTitle,
        workshop_username: parseWorkshopUsername(data.workshopUrl),
        city: data.city,
        city_id: data.cityId,
        film_format: data.filmFormat,
        runtime_minutes: data.runtimeMinutes,
        completion_year: data.completionYear,
        trailer_url: trailerUrl,
        film_url: filmUrl,
        access_notes: data.accessNotes,
        logline: data.logline,
        synopsis: data.synopsis,
        credits: data.credits,
        rights_confirmed: true,
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
          kind: "film_festival_submission_new",
          entityType: "film_festival_submission",
          entityId: inserted?.id ?? null,
          payload: {
            name: data.filmTitle,
            film_format: data.filmFormat,
            city: data.city,
          },
          dedupeWindowS: 0,
          allowSelf: true,
        });
      }
    } catch (err) {
      console.error("[film-festival] admin notify failed", err);
    }

    if (data.marketingOptIn) {
      const { upsertNewsletterSubscriber } = await import("@/lib/newsletter.server");
      try {
        await upsertNewsletterSubscriber(data.email, "film_festival_submission");
      } catch {
        // The submission is the primary record; never fail on list signup.
      }
    }

    return { ok: true };
  });

export const adminListFilmFestivalSubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data, error } = await supabaseAdmin
      .from("film_festival_submissions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as FilmFestivalSubmission[];
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

export const adminUpdateFilmFestivalSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status?: string; internalNotes?: string | null }) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(FILM_STATUSES).optional(),
        internalNotes: z.string().max(4000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const patch: { status?: FilmStatus; internal_notes?: string | null } = {};
    if (data.status) patch.status = data.status;
    if (data.internalNotes !== undefined) {
      patch.internal_notes = data.internalNotes?.trim() || null;
    }

    if (!Object.keys(patch).length) return { ok: true };

    const { error } = await supabaseAdmin
      .from("film_festival_submissions")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

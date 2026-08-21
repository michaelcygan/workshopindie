import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { domainError } from "@/lib/errors";

/**
 * Event "Featuring" — an optional, occurrence-specific list of the people a
 * night is built around (performer, vendor, host, speaker, artist).
 *
 * Deliberately small: this is not cohosting (no permissions), not editorial
 * featuring (`group_events.featured_at`), and not attendee showcase items.
 * Anything sourced from an Open House application stays internal — the public
 * payload never carries the application id, email, proposal, or notes.
 */

export type PublicEventFeature = {
  id: string;
  display_name: string;
  role_label: string;
  about: string;
  sort_order: number;
  profile: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

/** Public: the safe projection the Event page renders. */
export const listEventFeatures = createServerFn({ method: "GET" })
  .inputValidator((d: { eventId: string }) => z.object({ eventId: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<PublicEventFeature[]> => {
    // Visibility is decided by the parent event, exactly as the page is.
    const { data: ev } = await supabaseAdmin
      .from("group_events")
      .select("id,status,visibility,deleted_at")
      .eq("id", data.eventId)
      .maybeSingle();
    if (!ev || ev.deleted_at || ev.status === "draft") return [];

    const { data: rows, error } = await supabaseAdmin
      .from("group_event_features")
      .select("id,display_name,role_label,about,sort_order,created_at,user_id")
      .eq("event_id", data.eventId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = Array.from(new Set((rows ?? []).map((r) => r.user_id).filter(Boolean))) as string[];
    let profiles: Record<string, PublicEventFeature["profile"]> = {};
    if (ids.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id,username,display_name,avatar_url")
        .in("id", ids)
        .is("deleted_at", null);
      profiles = Object.fromEntries(
        (profs ?? []).map((p) => [
          p.id,
          {
            id: p.id as string,
            username: (p.username as string | null) ?? null,
            display_name: (p.display_name as string | null) ?? null,
            avatar_url: (p.avatar_url as string | null) ?? null,
          },
        ]),
      );
    }

    return (rows ?? []).map((r) => ({
      id: r.id as string,
      display_name: r.display_name as string,
      role_label: r.role_label as string,
      about: r.about as string,
      sort_order: (r.sort_order as number) ?? 0,
      profile: r.user_id ? (profiles[r.user_id as string] ?? null) : null,
    }));
  });

async function requireAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw domainError("FORBIDDEN", "Forbidden: admin only");
}

/** Admin: upcoming Open House occurrences that can take a booking. */
export const adminListOpenHouseOccurrences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);

    const { data: programs, error: pErr } = await supabaseAdmin
      .from("workshop_event_programs")
      .select("id")
      .eq("program_type", "open_house");
    if (pErr) throw new Error(pErr.message);
    const programIds = (programs ?? []).map((p) => p.id as string);
    if (!programIds.length) return { occurrences: [] as OpenHouseOccurrence[] };

    const { data: rows, error } = await supabaseAdmin
      .from("group_events")
      .select("id,slug,title,starts_at,timezone,venue_name,facilitation,status,group_id")
      .in("workshop_event_program_id", programIds)
      .is("deleted_at", null)
      .neq("status", "canceled")
      .neq("status", "draft")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(60);
    if (error) throw new Error(error.message);

    const eventIds = (rows ?? []).map((r) => r.id as string);
    const counts: Record<string, number> = {};
    if (eventIds.length) {
      const { data: feats } = await supabaseAdmin
        .from("group_event_features")
        .select("event_id")
        .in("event_id", eventIds);
      for (const f of feats ?? []) {
        const k = f.event_id as string;
        counts[k] = (counts[k] ?? 0) + 1;
      }
    }

    const groupIds = Array.from(new Set((rows ?? []).map((r) => r.group_id as string)));
    let slugs: Record<string, string> = {};
    if (groupIds.length) {
      const { data: gs } = await supabaseAdmin.from("groups").select("id,slug").in("id", groupIds);
      slugs = Object.fromEntries((gs ?? []).map((g) => [g.id as string, g.slug as string]));
    }

    return {
      occurrences: (rows ?? []).map((r) => ({
        id: r.id as string,
        slug: r.slug as string,
        groupSlug: slugs[r.group_id as string] ?? null,
        title: r.title as string,
        startsAt: r.starts_at as string,
        timezone: (r.timezone as string | null) ?? null,
        venueName: (r.venue_name as string | null) ?? null,
        facilitation: (r.facilitation as string | null) ?? null,
        featureCount: counts[r.id as string] ?? 0,
      })) as OpenHouseOccurrence[],
    };
  });

export type OpenHouseOccurrence = {
  id: string;
  slug: string;
  groupSlug: string | null;
  title: string;
  startsAt: string;
  timezone: string | null;
  venueName: string | null;
  facilitation: string | null;
  featureCount: number;
};

export type ApplicationBooking = {
  id: string;
  eventId: string;
  eventTitle: string;
  eventSlug: string;
  groupSlug: string | null;
  startsAt: string;
  displayName: string;
  roleLabel: string;
  about: string;
  userId: string | null;
};

/** Admin: every occurrence one application is booked for. */
export const adminListApplicationBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { applicationId: string }) =>
    z.object({ applicationId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("group_event_features")
      .select("id,event_id,display_name,role_label,about,user_id")
      .eq("open_house_application_id", data.applicationId);
    if (error) throw new Error(error.message);
    if (!rows?.length) return { bookings: [] as ApplicationBooking[] };

    const eventIds = rows.map((r) => r.event_id as string);
    const { data: evs } = await supabaseAdmin
      .from("group_events")
      .select("id,slug,title,starts_at,group_id")
      .in("id", eventIds);
    const groupIds = Array.from(new Set((evs ?? []).map((e) => e.group_id as string)));
    let slugs: Record<string, string> = {};
    if (groupIds.length) {
      const { data: gs } = await supabaseAdmin.from("groups").select("id,slug").in("id", groupIds);
      slugs = Object.fromEntries((gs ?? []).map((g) => [g.id as string, g.slug as string]));
    }
    const byId = Object.fromEntries((evs ?? []).map((e) => [e.id as string, e]));

    const bookings = rows
      .map((r) => {
        const ev = byId[r.event_id as string];
        return {
          id: r.id as string,
          eventId: r.event_id as string,
          eventTitle: (ev?.title as string) ?? "Event",
          eventSlug: (ev?.slug as string) ?? "",
          groupSlug: ev ? (slugs[ev.group_id as string] ?? null) : null,
          startsAt: (ev?.starts_at as string) ?? "",
          displayName: r.display_name as string,
          roleLabel: r.role_label as string,
          about: r.about as string,
          userId: (r.user_id as string | null) ?? null,
        };
      })
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

    return { bookings };
  });

const featurePayload = {
  displayName: z.string().trim().min(1, "Add a display name.").max(160),
  roleLabel: z.string().trim().min(1, "Add a role.").max(80),
  about: z
    .string()
    .trim()
    .min(1, "Write a short public description.")
    .max(600, "Keep the public description under 600 characters."),
};

/**
 * Admin: book an Open House applicant onto one exact occurrence.
 *
 * The feature row is created first; the application only moves to "booked"
 * once it exists, so a failure never leaves a phantom booking.
 */
export const adminBookApplicationForEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        applicationId: z.string().uuid(),
        eventId: z.string().uuid(),
        ...featurePayload,
        venueConfirmed: z.boolean(),
        makeHost: z.boolean().optional().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    if (!data.venueConfirmed) {
      throw domainError(
        "INVALID_INPUT",
        "Confirm the venue permits this activity before booking.",
      );
    }

    const { data: app, error: appErr } = await supabaseAdmin
      .from("open_house_applications")
      .select("id,user_id,status")
      .eq("id", data.applicationId)
      .maybeSingle();
    if (appErr) throw new Error(appErr.message);
    if (!app) throw domainError("NOT_FOUND", "Application not found.");

    const { data: ev, error: evErr } = await supabaseAdmin
      .from("group_events")
      .select("id,slug,group_id,deleted_at,status")
      .eq("id", data.eventId)
      .maybeSingle();
    if (evErr) throw new Error(evErr.message);
    if (!ev || ev.deleted_at) throw domainError("NOT_FOUND", "Event not found.");

    const { moderateOrThrow } = await import("@/lib/moderation/service.server");
    for (const text of [data.displayName, data.roleLabel, data.about]) {
      await moderateOrThrow({ userId: context.userId, surface: "event_feature", text });
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("group_event_features")
      .insert({
        event_id: data.eventId,
        user_id: app.user_id,
        display_name: data.displayName,
        role_label: data.roleLabel,
        about: data.about,
        open_house_application_id: data.applicationId,
      })
      .select("id")
      .maybeSingle();
    if (error) {
      if (error.code === "23505") {
        throw domainError("INVALID_INPUT", "This applicant is already booked for that night.");
      }
      throw new Error(error.message);
    }

    // Only a formal host changes how the night is facilitated. Performers,
    // vendors, and speakers never do.
    if (data.makeHost) {
      await supabaseAdmin
        .from("group_events")
        .update({ facilitation: "hosted" })
        .eq("id", data.eventId);
    }

    if (app.status !== "booked") {
      await supabaseAdmin
        .from("open_house_applications")
        .update({ status: "booked" })
        .eq("id", data.applicationId);
    }

    return { ok: true, featureId: inserted?.id ?? null };
  });

/** Admin: edit only the public feature copy. Never touches the application. */
export const adminUpdateEventFeature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), ...featurePayload }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { moderateOrThrow } = await import("@/lib/moderation/service.server");
    for (const text of [data.displayName, data.roleLabel, data.about]) {
      await moderateOrThrow({ userId: context.userId, surface: "event_feature", text });
    }
    const { error } = await supabaseAdmin
      .from("group_event_features")
      .update({
        display_name: data.displayName,
        role_label: data.roleLabel,
        about: data.about,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin: remove one booking. The application and its other nights survive. */
export const adminRemoveEventFeature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await supabaseAdmin
      .from("group_event_features")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

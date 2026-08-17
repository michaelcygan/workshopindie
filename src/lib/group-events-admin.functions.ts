import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { FIELD_IDS, subcategoryForPrimary } from "@/lib/taxonomy";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function assertAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Admin only");
}

const MAX_COVER_BYTES = 5 * 1024 * 1024;
const ALLOWED_COVER_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 5; // 5 years

/**
 * If cover_url points at an external host, download it server-side and re-upload
 * to our private `event-covers` bucket, then swap to a long-lived signed URL.
 * Returns the original URL on any failure — image rehost must never block publish.
 */
async function rehostCoverIfExternal(
  coverUrl: string | null | undefined,
  idHint: string,
): Promise<string | null> {
  if (!coverUrl) return coverUrl ?? null;
  let parsed: URL;
  try {
    parsed = new URL(coverUrl);
  } catch {
    return coverUrl;
  }
  if (!/^https?:$/.test(parsed.protocol)) return coverUrl;
  // Already on our storage? Skip.
  if (parsed.hostname.includes("supabase.co") && parsed.pathname.includes("/storage/v1/"))
    return coverUrl;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    let res: Response;
    try {
      res = await fetch(coverUrl, { signal: ctrl.signal, redirect: "follow" });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return coverUrl;
    const mime = (res.headers.get("content-type") || "").toLowerCase().split(";")[0].trim();
    if (!ALLOWED_COVER_MIMES.has(mime)) return coverUrl;
    const len = Number(res.headers.get("content-length") || "0");
    if (len > MAX_COVER_BYTES) return coverUrl;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_COVER_BYTES) return coverUrl;
    const ext =
      mime === "image/jpeg"
        ? "jpg"
        : mime === "image/png"
          ? "png"
          : mime === "image/webp"
            ? "webp"
            : "gif";
    const path = `${idHint}/${Date.now().toString(36)}.${ext}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const up = await supabaseAdmin.storage
      .from("event-covers")
      .upload(path, buf, { contentType: mime, upsert: false });
    if (up.error) return coverUrl;
    const signed = await supabaseAdmin.storage
      .from("event-covers")
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (signed.error || !signed.data?.signedUrl) return coverUrl;
    return signed.data.signedUrl;
  } catch {
    return coverUrl;
  }
}

// Reject javascript: / data: / embedded HTML; allow only http(s) URLs.
const safeHttpUrl = z
  .string()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), { message: "Must be an http(s) URL" });

const baseSchema = z.object({
  group_id: z.string().uuid(),
  extra_group_ids: z.array(z.string().uuid()).max(20).optional(),
  title: z.string().min(2).max(120),
  tagline: z.string().max(140).nullable().optional(),
  description: z.string().max(6000).nullable().optional(),
  kind: z.enum([
    "open_mic",
    "listening_party",
    "networking",
    "screening",
    "workshop_irl",
    "online",
    "other",
    "lineup",
  ]),
  /** Optional canonical Field — auto-connects the event to its Field Group. */
  creative_category: z.enum(FIELD_IDS).nullable().optional(),
  /** Optional specialization beneath the Field. Must belong to it. */
  subcategory: z.string().max(80).nullable().optional(),
  format: z.enum(["in_person", "online", "hybrid"]),
  cover_url: safeHttpUrl.nullable().optional(),
  accent_color: z.string().max(20).nullable().optional(),
  starts_at: z.string(),
  ends_at: z.string(),
  timezone: z.string().max(60).default("UTC"),
  venue_name: z.string().max(140).nullable().optional(),
  venue_address: z.string().max(300).nullable().optional(),
  venue_city_id: z.string().uuid().nullable().optional(),
  venue_lat: z.number().nullable().optional(),
  venue_lng: z.number().nullable().optional(),
  online_url: safeHttpUrl.nullable().optional(),
  capacity: z.number().int().min(1).max(10000).nullable().optional(),
  /** Extra RSVPs accepted beyond capacity for expected cancellations. Never negative. */
  overflow: z.number().int().min(0).max(10000).optional(),
  /** Canonical Workshop venue reference; null whenever the venue was hand-entered. */
  workshop_venue_key: z.string().max(80).nullable().optional(),
  /** Admin confirmed the venue's own reservation / Host an Event flow for this occurrence. */
  venue_policy_confirmed: z.boolean().optional(),
  waitlist_enabled: z.boolean().optional(),
  visibility: z.enum(["public", "group_only", "unlisted"]).optional(),
  rsvp_mode: z.enum(["open", "approval", "invite_only"]).optional(),
  is_official: z.boolean().optional(),
  featured: z.boolean().optional(),
  status: z.enum(["draft", "scheduled"]).optional(),
  series_key: z.string().max(60).nullable().optional(),
  lineup_capacity: z.number().int().min(1).max(200).nullable().optional(),
  source: z.enum(["workshop", "external"]).optional(),
  external_url: safeHttpUrl.nullable().optional(),
  external_organizer: z.string().max(140).nullable().optional(),
  is_recurring: z.boolean().optional(),
  recurrence_label: z.string().max(80).nullable().optional(),
  pinned: z.boolean().optional(),
}).superRefine((v, ctx) => {
  // A specialization is only meaningful under its own Field.
  if (!v.subcategory) return;
  if (!v.creative_category || !subcategoryForPrimary(v.subcategory, v.creative_category)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["subcategory"],
      message: "That specialization does not belong to the selected field.",
    });
  }
});

/**
 * An in-person / hybrid event needs a resolved city before it can be publicly
 * scheduled. If the host Group is an official city Group we inherit its city
 * (never overriding an explicitly chosen venue city). Drafts may stay
 * incomplete.
 */
async function resolveEventCity(
  supabase: { from: (t: string) => any },
  input: {
    group_id: string;
    format: "in_person" | "online" | "hybrid";
    venue_city_id?: string | null;
    status: string;
  },
): Promise<string | null> {
  if (input.format === "online") return input.venue_city_id ?? null;
  if (input.venue_city_id) return input.venue_city_id;
  const { data: group } = await supabase
    .from("groups")
    .select("kind,city_id")
    .eq("id", input.group_id)
    .maybeSingle();
  const inherited = group?.kind === "city" ? ((group?.city_id as string | null) ?? null) : null;
  if (!inherited && input.status !== "draft") {
    throw new Error(
      "Pick a venue so we can resolve the city — in-person events need a city before they can be published. Save it as a draft to finish later.",
    );
  }
  return inherited;
}

/**
 * Publish gate. A published Event is a public promise, so it must be complete:
 * real title, kind, format, a start, an end after the start, a sane timezone,
 * a venue for anything in person, and a way in for anything online.
 */
export function assertPublishable(ev: {
  title?: string | null;
  kind?: string | null;
  format?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  timezone?: string | null;
  venue_name?: string | null;
  venue_address?: string | null;
  online_url?: string | null;
  external_url?: string | null;
}) {
  const problems: string[] = [];
  if (!ev.title || ev.title.trim().length < 2) problems.push("a title");
  if (!ev.kind) problems.push("an event type");
  if (!ev.format) problems.push("a format");
  const start = ev.starts_at ? new Date(ev.starts_at).getTime() : NaN;
  const end = ev.ends_at ? new Date(ev.ends_at).getTime() : NaN;
  if (!Number.isFinite(start)) problems.push("a start time");
  if (!Number.isFinite(end)) problems.push("an end time");
  if (Number.isFinite(start) && Number.isFinite(end) && end <= start) {
    problems.push("an end time after the start");
  }
  const tz = ev.timezone ?? "";
  if (!tz) problems.push("a timezone");
  else {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
    } catch {
      problems.push("a valid timezone");
    }
  }
  if (ev.format === "in_person" || ev.format === "hybrid") {
    if (!ev.venue_name && !ev.venue_address) problems.push("a venue");
  }
  if (ev.format === "online" || ev.format === "hybrid") {
    if (!ev.online_url && !ev.external_url) {
      problems.push("an online link (or save it as a draft until you have one)");
    }
  }
  if (problems.length > 0) {
    throw new Error(`This Event still needs ${problems.join(", ")}.`);
  }
}

/**
 * Reconcile the canonical Workshop venue reference with the Event's own venue
 * snapshot, then enforce the venue's published group policy server-side so a
 * stale or modified client can never bypass it.
 *
 * - A hand-edited name/address detaches the canonical key (the snapshot stays
 *   authoritative for that occurrence).
 * - Reaching a published group-policy trigger, or an unverified walk-in
 *   policy, blocks publication until an admin explicitly confirms they went
 *   through the venue's own reservation / Host an Event flow.
 */
export function reconcileVenue(input: {
  workshop_venue_key?: string | null;
  venue_name?: string | null;
  venue_address?: string | null;
  capacity?: number | null;
  overflow?: number | null;
  venue_policy_confirmed?: boolean;
  status: string;
}): { key: string | null; policy: ReturnType<typeof evaluateVenuePolicy> } {
  const venue = getWorkshopVenue(input.workshop_venue_key);
  let key = venue?.key ?? null;
  if (venue) {
    const nameChanged =
      input.venue_name != null && input.venue_name.trim() !== venue.venue_name;
    const addressChanged =
      input.venue_address != null && input.venue_address.trim() !== venue.address;
    if (nameChanged || addressChanged) key = null;
  }
  const policy = evaluateVenuePolicy({
    key,
    capacity: input.capacity ?? null,
    overflow: input.overflow ?? 0,
    confirmed: input.venue_policy_confirmed === true,
  });
  if (input.status !== "draft" && policy.requiresReview) {
    throw new Error(
      `${policy.reason} Confirm the venue policy for this occurrence to publish it anyway.`,
    );
  }
  return { key, policy };
}

export const createEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => baseSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const {
      featured,
      status,
      cover_url,
      pinned,
      extra_group_ids,
      venue_policy_confirmed,
      ...rest
    } = data;
    const rehostedCover = await rehostCoverIfExternal(cover_url, `g_${data.group_id}`);
    const effectiveStatus = (status ?? "scheduled") as "draft" | "scheduled";
    const venueCityId = await resolveEventCity(supabase as never, {
      group_id: data.group_id,
      format: data.format,
      venue_city_id: data.venue_city_id ?? null,
      status: effectiveStatus,
    });
    if (effectiveStatus !== "draft") assertPublishable(data);
    const { key: venueKey } = reconcileVenue({
      workshop_venue_key: data.workshop_venue_key ?? null,
      venue_name: data.venue_name ?? null,
      venue_address: data.venue_address ?? null,
      capacity: data.capacity ?? null,
      overflow: data.overflow ?? 0,
      venue_policy_confirmed,
      status: effectiveStatus,
    });
    const insertRow = {
      ...rest,
      overflow: data.overflow ?? 0,
      workshop_venue_key: venueKey,
      venue_policy_confirmed_at: venue_policy_confirmed ? new Date().toISOString() : null,
      venue_policy_confirmed_by: venue_policy_confirmed ? userId : null,
      venue_city_id: venueCityId,
      cover_url: rehostedCover,
      slug: "",
      created_by: userId,
      featured_at: featured ? new Date().toISOString() : null,
      pinned_at: pinned ? new Date().toISOString() : null,
      status: effectiveStatus,
      // A draft is private until it is explicitly published.
      published_at: effectiveStatus === "draft" ? null : new Date().toISOString(),
      archived_at: null,
      is_official: data.source === "external" ? false : (data.is_official ?? true),
    };

    const { data: row, error } = await supabase
      .from("group_events")
      .insert(insertRow as never)
      .select("id,slug,group_id")
      .single();
    if (error) throw new Error(error.message);

    // Tag the event to its primary group + any extras. Primary is always included.
    {
      const allGroupIds = Array.from(new Set([data.group_id, ...(extra_group_ids ?? [])]));
      const links = allGroupIds.map((gid) => ({ event_id: row.id, group_id: gid }));
      const { error: linkErr } = await supabase
        .from("event_groups")
        .upsert(links, { onConflict: "event_id,group_id", ignoreDuplicates: true });
      if (linkErr) throw new Error(linkErr.message);
    }

    // Notify all group members (except the creator) of the new event. Skip for drafts.
    if (insertRow.status !== "draft")
      try {
        const { data: group } = await supabase
          .from("groups")
          .select("slug,name")
          .eq("id", data.group_id)
          .maybeSingle();
        const { data: members } = await supabase
          .from("group_members")
          .select("user_id")
          .eq("group_id", data.group_id);
        const recipients = (members ?? [])
          .map((m) => m.user_id as string)
          .filter((uid) => uid && uid !== userId);
        if (group && recipients.length > 0) {
          const g = group as { slug: string; name: string };
          const payload = {
            event_title: data.title,
            event_slug: row.slug,
            group_slug: g.slug,
            group_name: g.name,
          };
          const { notifyMany } = await import("@/lib/notifications/deliver.server");
          await notifyMany({
            recipientIds: recipients,
            actorUserId: userId,
            kind: "event_new_in_my_group",
            entityType: "group_event",
            entityId: row.id,
            payload,
          });
        }
      } catch {
        // Notifications are best-effort; never block event creation.
      }
    return row;
  });

const updateSchema = baseSchema.partial().extend({ id: z.string().uuid() });

export const updateEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => updateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { id, featured, pinned, extra_group_ids: _extra, ...rest } = data;
    void _extra;
    const patch: Record<string, unknown> = { ...rest };
    if (typeof featured === "boolean") {
      patch.featured_at = featured ? new Date().toISOString() : null;
    }
    if (typeof pinned === "boolean") {
      patch.pinned_at = pinned ? new Date().toISOString() : null;
    }
    // Moving a draft to scheduled through the editor publishes it.
    if (rest.status === "scheduled") {
      const { data: current } = await supabase
        .from("group_events")
        .select(
          "title,kind,format,starts_at,ends_at,timezone,venue_name,venue_address,online_url,external_url,published_at",
        )
        .eq("id", id)
        .maybeSingle();
      const merged = { ...(current ?? {}), ...rest } as Parameters<typeof assertPublishable>[0] & {
        published_at?: string | null;
      };
      assertPublishable(merged);
      if (!merged.published_at) patch.published_at = new Date().toISOString();
      patch.archived_at = null;
    }
    if (rest.status === "draft") {
      patch.published_at = null;
    }
    const { error } = await supabase
      .from("group_events")
      .update(patch as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Publish a draft Event — the one action that makes a flyer public. */
export const publishEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: row, error: readErr } = await supabase
      .from("group_events")
      .select(
        "id,title,kind,format,starts_at,ends_at,timezone,venue_name,venue_address,online_url,external_url,published_at",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!row) throw new Error("Event not found");
    assertPublishable(row as Parameters<typeof assertPublishable>[0]);
    const { error } = await supabase
      .from("group_events")
      .update({
        status: "scheduled",
        published_at:
          (row as { published_at: string | null }).published_at ?? new Date().toISOString(),
        archived_at: null,
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Send an Event to the archive early, or restore it. */
export const setEventArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), archived: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("group_events")
      .update({ archived_at: data.archived ? new Date().toISOString() : null } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Pull a published Event back to a private draft. */
export const unpublishEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("group_events")
      .update({ status: "draft", published_at: null } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), reason: z.string().max(500).optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("group_events")
      .update({ status: "canceled" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    // notify rsvps
    const { data: rsvps } = await supabase
      .from("group_event_rsvps")
      .select("user_id")
      .eq("event_id", data.id)
      .in("status", ["going", "maybe", "waitlist"]);
    const { data: ev } = await supabase
      .from("group_events")
      .select("title,slug,group:groups!inner(slug)")
      .eq("id", data.id)
      .maybeSingle();
    if (ev && rsvps && rsvps.length > 0) {
      type EvShape = { title: string; slug: string; group: { slug: string } };
      const e = ev as unknown as EvShape;
      const payload = {
        event_title: e.title,
        event_slug: e.slug,
        group_slug: e.group.slug,
        reason: data.reason ?? null,
      };
      const { notifyMany } = await import("@/lib/notifications/deliver.server");
      await notifyMany({
        recipientIds: rsvps.map((r) => r.user_id as string),
        actorUserId: userId,
        kind: "event_canceled",
        entityType: "group_event",
        entityId: data.id,
        payload,
      });
    }
    return { ok: true };
  });

export const setEventFeatured = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), featured: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("group_events")
      .update({ featured_at: data.featured ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const postEventUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ event_id: z.string().uuid(), body: z.string().min(1).max(1000) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("group_event_updates")
      .insert({ event_id: data.event_id, body: data.body, created_by: userId });
    if (error) throw new Error(error.message);
    // notify going rsvps
    const { data: rsvps } = await supabase
      .from("group_event_rsvps")
      .select("user_id")
      .eq("event_id", data.event_id)
      .in("status", ["going", "maybe"]);
    const { data: ev } = await supabase
      .from("group_events")
      .select("title,slug,group:groups!inner(slug)")
      .eq("id", data.event_id)
      .maybeSingle();
    if (ev && rsvps && rsvps.length > 0) {
      type EvShape = { title: string; slug: string; group: { slug: string } };
      const e = ev as unknown as EvShape;
      const payload = { event_title: e.title, event_slug: e.slug, group_slug: e.group.slug };
      const { notifyMany } = await import("@/lib/notifications/deliver.server");
      await notifyMany({
        recipientIds: rsvps.map((r) => r.user_id as string),
        actorUserId: userId,
        kind: "event_updated",
        entityType: "group_event",
        entityId: data.event_id,
        payload,
      });
    }
    return { ok: true };
  });

export const adminListAllEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("group_events")
      .select(
        "id,slug,title,kind,format,starts_at,status,featured_at,going_count,capacity,group:groups!inner(id,slug,name)",
      )
      .is("deleted_at", null)
      .order("starts_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminListGroups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data } = await supabase
      .from("groups")
      .select("id,slug,name,kind")
      .is("deleted_at", null)
      .order("name");
    return data ?? [];
  });

// ---------- Recurring series (rolling materialization) ----------

const seriesSchema = baseSchema.omit({ starts_at: true, ends_at: true }).extend({
  starts_at: z.string(),
  ends_at: z.string(),
  recurrence_rule: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]),
  // Kept optional for backwards-compat with older callers; ignored by the rolling model.
  occurrence_count: z.number().int().min(1).max(52).optional(),
  ends_on: z.string().nullable().optional(),
});

export const createEventSeries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => seriesSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const {
      recurrence_rule,
      occurrence_count: _occ,
      ends_on,
      featured,
      status,
      cover_url,
      pinned,
      extra_group_ids,
      starts_at,
      ends_at,
      group_id,
      ...rest
    } = data;
    void _occ;
    const baseStart = new Date(starts_at);
    const baseEnd = new Date(ends_at);
    if (Number.isNaN(baseStart.getTime()) || Number.isNaN(baseEnd.getTime())) {
      throw new Error("Invalid start or end time");
    }
    const durationMs = baseEnd.getTime() - baseStart.getTime();
    if (durationMs <= 0 || durationMs > 24 * 60 * 60 * 1000) {
      throw new Error("End time must be after start and within 24 hours");
    }
    const seriesKey = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const sharedCover = await rehostCoverIfExternal(cover_url, `series_${seriesKey}`);
    const effectiveStatus = (status ?? "scheduled") as "draft" | "scheduled";
    const tz = rest.timezone || "UTC";
    const venueCityId = await resolveEventCity(supabase as never, {
      group_id,
      format: rest.format,
      venue_city_id: rest.venue_city_id ?? null,
      status: effectiveStatus,
    });

    const { toZonedParts } = await import("@/lib/event-series.server");
    const localAnchor = toZonedParts(baseStart, tz);
    const pad = (n: number) => String(n).padStart(2, "0");

    // Template is copied into every future occurrence by the materializer.
    // We omit fields the materializer sets itself: group_id, starts_at, ends_at, slug, created_by, series_key.
    const template: Record<string, unknown> = {
      ...rest,
      venue_city_id: venueCityId,
      timezone: tz,
      cover_url: sharedCover,
      status: effectiveStatus,
      is_official: rest.source === "external" ? false : (rest.is_official ?? true),
      is_recurring: true,
      // Credit travels with the series: every future week keeps the organizer
      // and their link, so occurrences never fall back to the city Group.
      source: rest.source ?? "workshop",
      external_url: rest.external_url ?? null,
      external_organizer: rest.external_organizer ?? null,
      // Pin intent belongs to the series; only its nearest future occurrence
      // ever carries `pinned_at`.
      __pin: pinned === true,
    };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: seriesRow, error: seriesErr } = await supabaseAdmin
      .from("event_series")
      .insert({
        group_id,
        series_key: seriesKey,
        recurrence_rule,
        weekday: new Date(
          Date.UTC(localAnchor.year, localAnchor.month - 1, localAnchor.day),
        ).getUTCDay(),
        day_of_month: recurrence_rule === "MONTHLY" ? localAnchor.day : null,
        start_time_local: `${pad(localAnchor.hour)}:${pad(localAnchor.minute)}:${pad(localAnchor.second)}`,
        duration_minutes: Math.round(durationMs / 60000),
        timezone: tz,
        template,
        horizon_weeks: 8,
        next_occurrence_at: baseStart.toISOString(),
        ends_on: ends_on ?? null,
        extra_group_ids: (extra_group_ids ?? []).filter((id) => id !== group_id),
        created_by: userId,
      } as never)
      .select(
        "id,series_key,group_id,recurrence_rule,duration_minutes,template,horizon_weeks,next_occurrence_at,ends_on,timezone,start_time_local,extra_group_ids",
      )
      .single();
    if (seriesErr || !seriesRow) throw new Error(seriesErr?.message ?? "Failed to create series");

    const { materializeSeries } = await import("@/lib/event-series.server");
    const insertedCount = await materializeSeries(supabaseAdmin, seriesRow as never, userId);

    if (featured) {
      const { data: firstRow } = await supabaseAdmin
        .from("group_events")
        .select("id")
        .eq("series_key", seriesKey)
        .order("starts_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (firstRow) {
        await supabaseAdmin
          .from("group_events")
          .update({ featured_at: new Date().toISOString() } as never)
          .eq("id", firstRow.id);
      }
    }
    return { series_key: seriesKey, count: insertedCount };
  });

/** Manual trigger: materialize every active series that's due for a top-up. */
export const runEventSeriesMaterializer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { materializeAllDueSeries } = await import("@/lib/event-series.server");
    return await materializeAllDueSeries(supabaseAdmin);
  });

// ---------- "Not an event" reports ----------

export const adminListEventReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: reports, error } = await supabase
      .from("reports")
      .select("id,entity_id,reason,description,created_at")
      .eq("entity_type", "group_event")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const list = reports ?? [];
    if (list.length === 0) return [];
    const eventIds = Array.from(new Set(list.map((r) => r.entity_id as string)));
    const { data: events } = await supabase
      .from("group_events")
      .select("id,slug,title,status,group:groups!inner(slug,name)")
      .in("id", eventIds);
    type Ev = {
      id: string;
      slug: string;
      title: string;
      status: string;
      group: { slug: string; name: string };
    };
    const byId = new Map<string, Ev>();
    for (const e of (events ?? []) as unknown as Ev[]) byId.set(e.id, e);
    const grouped = new Map<
      string,
      { event: Ev; report_ids: string[]; reasons: string[]; latest_at: string }
    >();
    for (const r of list) {
      const ev = byId.get(r.entity_id as string);
      if (!ev) continue;
      const g = grouped.get(ev.id);
      if (g) {
        g.report_ids.push(r.id as string);
        if (r.reason) g.reasons.push(r.reason as string);
      } else {
        grouped.set(ev.id, {
          event: ev,
          report_ids: [r.id as string],
          reasons: r.reason ? [r.reason as string] : [],
          latest_at: r.created_at as string,
        });
      }
    }
    return Array.from(grouped.values());
  });

export const adminDismissReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ report_ids: z.array(z.string().uuid()).min(1).max(200) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("reports")
      .update({ status: "dismissed" })
      .in("id", data.report_ids);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Series-wide edits (future occurrences only) ----------

const seriesPatchSchema = z.object({
  series_key: z.string().min(3).max(60),
  from_event_id: z.string().uuid(),
  patch: z.object({
    title: z.string().min(2).max(120).optional(),
    tagline: z.string().max(140).nullable().optional(),
    description: z.string().max(6000).nullable().optional(),
    venue_name: z.string().max(140).nullable().optional(),
    venue_address: z.string().max(300).nullable().optional(),
    online_url: z.string().url().nullable().optional(),
    cover_url: z.string().url().nullable().optional(),
    capacity: z.number().int().min(1).max(10000).nullable().optional(),
  }),
});

export const updateEventSeriesFuture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => seriesPatchSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: anchor, error: anchorErr } = await supabase
      .from("group_events")
      .select("starts_at,series_key")
      .eq("id", data.from_event_id)
      .maybeSingle();
    if (anchorErr || !anchor) throw new Error("Anchor event not found");
    if (anchor.series_key !== data.series_key) throw new Error("Anchor is not in this series");

    const patch: Record<string, unknown> = { ...data.patch };
    if (typeof patch.cover_url === "string") {
      patch.cover_url = await rehostCoverIfExternal(
        patch.cover_url as string,
        `series_${data.series_key}`,
      );
    }
    const { error, count } = await supabase
      .from("group_events")
      .update(patch as never, { count: "exact" })
      .eq("series_key", data.series_key)
      .gte("starts_at", anchor.starts_at as string);
    if (error) throw new Error(error.message);

    // Merge the same patch into the series template so future materialized
    // occurrences pick it up too.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: seriesRow } = await supabaseAdmin
        .from("event_series")
        .select("id,template")
        .eq("series_key", data.series_key)
        .maybeSingle();
      if (seriesRow) {
        const s = seriesRow as unknown as { id: string; template: Record<string, unknown> };
        const nextTemplate = { ...(s.template ?? {}), ...patch };
        await supabaseAdmin
          .from("event_series")
          .update({ template: nextTemplate } as never)
          .eq("id", s.id);
      }
    } catch {
      /* best-effort — occurrence rows are already updated */
    }

    return { ok: true, updated: count ?? 0 };
  });

export const cancelEventSeriesFuture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        series_key: z.string().min(3).max(60),
        from_event_id: z.string().uuid(),
        reason: z.string().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: anchor } = await supabase
      .from("group_events")
      .select("starts_at,series_key")
      .eq("id", data.from_event_id)
      .maybeSingle();
    if (!anchor || anchor.series_key !== data.series_key)
      throw new Error("Anchor is not in this series");
    const { data: rows, error } = await supabase
      .from("group_events")
      .update({ status: "canceled" })
      .eq("series_key", data.series_key)
      .gte("starts_at", anchor.starts_at as string)
      .neq("status", "canceled")
      .select("id,title,slug,group:groups!inner(slug)");
    if (error) throw new Error(error.message);
    type R = { id: string; title: string; slug: string; group: { slug: string } };
    const canceled = (rows ?? []) as unknown as R[];

    // Best-effort RSVP notifications
    for (const ev of canceled) {
      try {
        const { data: rsvps } = await supabase
          .from("group_event_rsvps")
          .select("user_id")
          .eq("event_id", ev.id)
          .in("status", ["going", "maybe", "waitlist"]);
        if (rsvps && rsvps.length > 0) {
          const payload = {
            event_title: ev.title,
            event_slug: ev.slug,
            group_slug: ev.group.slug,
            reason: data.reason ?? null,
          };
          const { notifyMany } = await import("@/lib/notifications/deliver.server");
          await notifyMany({
            recipientIds: rsvps.map((r) => r.user_id as string),
            actorUserId: userId,
            kind: "event_canceled",
            entityType: "group_event",
            entityId: ev.id,
            payload,
          });
        }
      } catch {
        /* notifications are best-effort */
      }
    }

    // Stop the rolling materializer from creating more occurrences.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("event_series")
        .update({ canceled_at: new Date().toISOString() } as never)
        .eq("series_key", data.series_key)
        .is("canceled_at", null);
    } catch {
      /* best-effort */
    }

    return { ok: true, canceled: canceled.length };
  });

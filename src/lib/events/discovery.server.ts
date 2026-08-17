/**
 * Single source of truth for reading events across Workshop.
 *
 * Every discovery surface (the /events feed, group event tabs, city pages,
 * the "Now" board, homepage strips, MCP) builds its query here so the same
 * invariants hold everywhere:
 *
 *  1. never surface soft-deleted events (`deleted_at is null`)
 *  2. never surface canceled events in discovery
 *  3. never surface events whose owning group is soft-deleted
 *  4. public discovery only sees `visibility = 'public'`
 *  5. every returned row carries enough data to build the canonical
 *     Workshop event URL — `/g/{groupSlug}/e/{eventSlug}`
 *
 * Server-only: uses the publishable-key client (RLS applies as anon).
 */
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  DISCOVERABLE_STATUSES as STATUSES,
  DEFAULT_EVENT_DURATION_MS,
  collapseSeries,
} from "@/lib/events/filters";

/** Full column list for an event detail read. */
export const EVENT_FIELDS =
  "id,group_id,slug,title,tagline,description,kind,format,cover_url,accent_color,starts_at,ends_at,timezone,venue_name,venue_address,venue_city_id,venue_lat,venue_lng,online_url,capacity,overflow,workshop_venue_key,waitlist_enabled,visibility,rsvp_mode,status,is_official,featured_at,going_count,maybe_count,waitlist_count,created_by,created_at,series_key,short_code,lineup_capacity,source,external_url,external_organizer,is_recurring,recurrence_label,pinned_at,published_at,archived_at";

/** Lean column list for cards / lists. */
export const EVENT_CARD_FIELDS =
  "id,group_id,slug,title,tagline,kind,format,cover_url,accent_color,starts_at,ends_at,timezone,venue_name,venue_address,venue_city_id,online_url,capacity,going_count,maybe_count,status,visibility,featured_at,pinned_at,is_recurring,recurrence_label,series_key,short_code,published_at,archived_at,daypart,min_age,facilitation,drop_in_allowed";

export const GROUP_JOIN =
  "group:groups!group_events_group_id_fkey!inner(id,slug,name,avatar_url,kind,accent_color,visibility,deleted_at)";

export const CITY_JOIN = "city:cities!group_events_venue_city_id_fkey(id,name,slug)";

export type DiscoveryEvent = {
  id: string;
  group_id: string;
  slug: string;
  title: string;
  tagline: string | null;
  kind: string;
  format: "in_person" | "online" | "hybrid";
  cover_url: string | null;
  accent_color: string | null;
  starts_at: string;
  ends_at: string | null;
  timezone: string | null;
  venue_name: string | null;
  venue_address: string | null;
  venue_city_id: string | null;
  online_url: string | null;
  capacity: number | null;
  going_count: number | null;
  maybe_count: number | null;
  status: string;
  visibility: string;
  featured_at: string | null;
  pinned_at: string | null;
  is_recurring: boolean | null;
  recurrence_label: string | null;
  series_key: string | null;
  short_code: string | null;
  published_at?: string | null;
  archived_at?: string | null;
  group: {
    id: string;
    slug: string;
    name: string;
    avatar_url: string | null;
    accent_color: string | null;
    visibility: string;
    deleted_at: string | null;
  } | null;
  city?: { id: string; name: string; slug: string } | null;
};

/**
 * The one canonical destination for an event anywhere in Workshop.
 * External links are never used as a card's primary target.
 */
export { canonicalEventPath } from "@/lib/events/filters";

export function publicEventsClient(): SupabaseClient<Database> {
  const url = process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export type EventWhen = "upcoming" | "past" | "any";
export type EventFormatFilter = "all" | "in_person" | "online";

export type DiscoveryFilters = {
  /** Time window relative to now. Default: "upcoming". */
  when?: EventWhen;
  /** Restrict to a city (ignored for the "online" format filter). */
  cityId?: string | null;
  /** Restrict to one group. */
  groupId?: string | null;
  /** Restrict to a set of groups (e.g. the viewer's memberships). */
  groupIds?: string[] | null;
  /** Restrict to an event kind. */
  kind?: string | null;
  /** Co-working: restrict to a part of the day. */
  daypart?: string | null;
  /** Free-text match on title / tagline / venue name. */
  q?: string | null;
  /** Slug of a system medium group (music, film-video, writing, …). */
  medium?: string | null;
  format?: EventFormatFilter;

  /** Only events marked featured. */
  featuredOnly?: boolean;
  /** Hard lower bound on starts_at (ISO). */
  after?: string | null;
  /** Hard upper bound on starts_at (ISO). */
  before?: string | null;
  /** Include the joined city row. */
  withCity?: boolean;
  limit?: number;
  /** Column list override; defaults to EVENT_CARD_FIELDS. */
  fields?: string;
  /**
   * Collapse recurring series to their nearest occurrence. Default: true.
   * A group's own archive/series view can opt out.
   */
  collapseRecurring?: boolean;
};

/** Statuses that may appear in discovery — `canceled` and `draft` never do. */
export { DISCOVERABLE_STATUSES } from "@/lib/events/filters";

/**
 * Build + run the canonical discovery query. Returns [] on error rather than
 * throwing, so one bad surface never blanks a page.
 */
export async function listDiscoveryEvents(
  filters: DiscoveryFilters = {},
  client?: SupabaseClient<Database>,
): Promise<DiscoveryEvent[]> {
  const {
    when = "upcoming",
    cityId = null,
    groupId = null,
    groupIds = null,
    kind = null,
    daypart = null,
    q: text = null,
    medium = null,
    format = "all",

    featuredOnly = false,
    after = null,
    before = null,
    withCity = false,
    limit = 60,
    fields = EVENT_CARD_FIELDS,
    collapseRecurring = true,
  } = filters;

  const supabase = client ?? publicEventsClient();
  const nowIso = new Date().toISOString();
  const select = [fields, GROUP_JOIN, withCity ? CITY_JOIN : null].filter(Boolean).join(",");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from("group_events")
    .select(select)
    .is("deleted_at", null)
    .eq("visibility", "public")
    .in("status", STATUSES as never)
    // Lifecycle: only published, non-archived flyers are discoverable.
    .not("published_at", "is", null)
    .is("archived_at", null);

  // An event stays "current" until it ends, not until it starts. Rows with no
  // end time get a fixed grace window so they don't linger forever.
  const graceIso = new Date(Date.now() - DEFAULT_EVENT_DURATION_MS).toISOString();

  if (when === "upcoming") {
    if (after) {
      q = q.gte("starts_at", after);
    } else {
      q = q.or(`ends_at.gte.${nowIso},and(ends_at.is.null,starts_at.gte.${graceIso})`);
    }
    q = q.order("starts_at", { ascending: true });
  } else if (when === "past") {
    if (before) {
      q = q.lt("starts_at", before);
    } else {
      q = q.or(`ends_at.lt.${nowIso},and(ends_at.is.null,starts_at.lt.${graceIso})`);
    }
    q = q.order("starts_at", { ascending: false });
  } else {
    if (after) q = q.gte("starts_at", after);
    if (before) q = q.lte("starts_at", before);
    q = q.order("starts_at", { ascending: true });
  }

  if (format === "in_person") q = q.in("format", ["in_person", "hybrid"]);
  if (format === "online") q = q.in("format", ["online", "hybrid"]);
  if (cityId && format !== "online") q = q.eq("venue_city_id", cityId);
  if (groupId) q = q.eq("group_id", groupId);
  if (groupIds && groupIds.length > 0) q = q.in("group_id", groupIds);
  if (kind) q = q.eq("kind", kind);
  if (daypart) q = q.eq("daypart", daypart);
  if (featuredOnly) q = q.not("featured_at", "is", null);

  const { data, error } = await q.limit(limit);
  if (error) {
    console.error("[events/discovery] query failed:", error.message);
    return [];
  }
  const rows = sanitizeDiscoveryRows(data);
  return collapseRecurring ? collapseSeries(rows) : rows;
}

/**
 * Drop rows whose owning group is soft-deleted or missing. PostgREST can't
 * express this as a filter on the embedded resource, so it's enforced here —
 * every caller gets the same guarantee.
 */
export function sanitizeDiscoveryRows(rows: unknown): DiscoveryEvent[] {
  return ((rows ?? []) as DiscoveryEvent[]).filter(
    (e) => e && e.group && !e.group.deleted_at && !!e.group.slug,
  );
}

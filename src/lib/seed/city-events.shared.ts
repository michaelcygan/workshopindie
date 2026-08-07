/**
 * Shared shape for city event seeds (Chicago, Milwaukee, …).
 *
 * Every seeded row is an external listing: Workshop is the discovery layer,
 * never the organizer. `source: "external"` and `is_official: false` are
 * enforced here so no city manifest can accidentally claim a third-party
 * event as Workshop's own.
 */

export type SeedCategory = "music" | "film_video" | "writing" | "visual_art" | "games_tech";
export type SeedKind =
  | "open_mic"
  | "listening_party"
  | "networking"
  | "screening"
  | "workshop_irl"
  | "online"
  | "other"
  | "lineup";

export type SeedBase = {
  /** Stable idempotency key. Becomes `series_key`. Never change. */
  key: string;
  title: string;
  tagline: string;
  description: string;
  kind: SeedKind;
  creative_category: SeedCategory;
  /** Extra mediums this event genuinely belongs to (each becomes a Group). */
  secondary_categories?: SeedCategory[];
  /** Defaults to in_person. Online groups set this explicitly. */
  format?: "in_person" | "online" | "hybrid";

  venue_name: string;
  /** Omitted when the organizer publishes no street address. */
  venue_address?: string;
  /** The organizer's own page — always linked from the Workshop event. */
  external_url: string;
  external_organizer: string;
  /** Where the schedule was verified from. Internal provenance note. */
  source_note: string;
  duration_minutes: number;
  cover_url?: string;
  photo_credit_name?: string;
  photo_credit_url?: string;
};

export type SeedWeekly = SeedBase & {
  cadence: "weekly";
  /** 0 = Sunday … 6 = Saturday, local time. */
  weekday: number;
  /** Local start, 24h "HH:MM". */
  start_local: string;
  recurrence_label: string;
};

export type SeedBiweekly = SeedBase & {
  cadence: "biweekly";
  /** A verified published occurrence to anchor the every-two-weeks cadence. */
  anchor_local: string; // "YYYY-MM-DDTHH:MM"
  recurrence_label: string;
};

export type SeedDated = SeedBase & {
  cadence: "dated";
  /** Local dates/times published by the organizer, "YYYY-MM-DDTHH:MM". */
  occurrences: string[];
  recurrence_label: string;
};

export type SeedEvent = SeedWeekly | SeedBiweekly | SeedDated;

/** Medium Group slugs, keyed by creative category. */
export const MEDIUM_GROUP_SLUG: Record<SeedCategory, string> = {
  music: "music",
  film_video: "film-video",
  writing: "writing",
  visual_art: "visual-art",
  games_tech: "games-tech",
};

/**
 * Row shape shared by every seeded occurrence. Third-party listings are never
 * Workshop-official and always carry the organizer's own link.
 */
export function buildSeedTemplate(
  ev: SeedEvent,
  timezone: string,
  venueCityId: string | null,
): Record<string, unknown> {
  const online = ev.format === "online";
  return {
    title: ev.title,
    tagline: ev.tagline,
    description: ev.description,
    kind: ev.kind,
    creative_category: ev.creative_category,
    format: ev.format ?? "in_person",
    cover_url: ev.cover_url ?? null,
    photo_credit_name: ev.photo_credit_name ?? null,
    photo_credit_url: ev.photo_credit_url ?? null,
    timezone,
    venue_name: ev.venue_name,
    venue_address: ev.venue_address ?? null,
    // Online events never claim a physical location.
    venue_city_id: online ? null : venueCityId,
    visibility: "public",
    rsvp_mode: "open",
    status: "scheduled",
    is_official: false,
    source: "external",
    external_url: ev.external_url,
    external_organizer: ev.external_organizer,
    is_recurring: true,
    recurrence_label: ev.recurrence_label,
  };
}

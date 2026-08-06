/**
 * Verified Chicago recurring-events manifest.
 *
 * Every entry here is a real event run by a real venue or organizer. Workshop
 * neither organizes nor sponsors any of them: each row is seeded as
 * `source: "external"`, `is_official: false`, and always carries the
 * organizer's own page as `external_url`.
 *
 * Rules for adding to this file:
 *  - The schedule must be stated on the organizer's or venue's own site.
 *  - `source_note` records where the schedule was read, so it can be re-checked.
 *  - `key` is a stable identifier. Never rename one — it is the idempotency key.
 */

export type SeedCategory = "music" | "film_video" | "writing" | "visual_art" | "games_tech";
export type SeedKind = "open_mic" | "listening_party" | "networking" | "screening" | "workshop_irl" | "online" | "other" | "lineup";

type SeedBase = {
  /** Stable idempotency key. Becomes `series_key`. Never change. */
  key: string;
  title: string;
  tagline: string;
  description: string;
  kind: SeedKind;
  creative_category: SeedCategory;
  venue_name: string;
  venue_address: string;
  /** The organizer's own page — always linked from the Workshop event. */
  external_url: string;
  external_organizer: string;
  /** Where the schedule was verified from. Internal provenance note. */
  source_note: string;
  /** Minutes. Where the venue states no end time we use a conservative block. */
  duration_minutes: number;
};

export type SeedWeekly = SeedBase & {
  cadence: "weekly";
  /** 0 = Sunday … 6 = Saturday, in America/Chicago local time. */
  weekday: number;
  /** Local start, 24h "HH:MM". */
  start_local: string;
  recurrence_label: string;
};

export type SeedDated = SeedBase & {
  cadence: "dated";
  /** Local dates/times published by the organizer, "YYYY-MM-DDTHH:MM". */
  occurrences: string[];
  recurrence_label: string;
};

export type SeedEvent = SeedWeekly | SeedDated;

export const CHICAGO_TIMEZONE = "America/Chicago";

/**
 * Row shape shared by every seeded occurrence. Third-party listings are never
 * Workshop-official and always carry the organizer's own link.
 */
export function seedTemplate(ev: SeedEvent, venueCityId: string | null): Record<string, unknown> {
  return {
    title: ev.title,
    tagline: ev.tagline,
    description: ev.description,
    kind: ev.kind,
    creative_category: ev.creative_category,
    format: "in_person",
    timezone: CHICAGO_TIMEZONE,
    venue_name: ev.venue_name,
    venue_address: ev.venue_address,
    venue_city_id: venueCityId,
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
export const CHICAGO_GROUP_SLUG = "chicago";

export const CHICAGO_SEED_EVENTS: SeedEvent[] = [
  {
    key: "chi_uncommon_ground_open_mic",
    cadence: "weekly",
    weekday: 0,
    start_local: "18:00",
    duration_minutes: 180,
    recurrence_label: "Every Sunday",
    title: "Open Mic at Uncommon Ground",
    tagline: "Sign-up at 5pm, music from 6pm. All ages.",
    description:
      "Uncommon Ground's Lakeview room runs one of the longest-standing open mics in Chicago. Sign-up opens at 5:00pm and the mic starts at 6:00pm — arrive early to guarantee a slot. Sets run roughly 5 to 15 minutes depending on how many performers turn up. Up to three people per act; no full bands or drum kits. All ages, $5 suggested donation that goes to the performers.",
    kind: "open_mic",
    creative_category: "music",
    venue_name: "Uncommon Ground Lakeview",
    venue_address: "3800 N Clark St, Chicago, IL 60613",
    external_url: "https://www.uncommonground.com/openmic",
    external_organizer: "Uncommon Ground Lakeview",
    source_note: "uncommonground.com/openmic — 'Sunday nights: Sign up at 5:00pm | open mic starts at 6pm'.",
  },
  {
    key: "chi_gallery_cabaret_open_jam",
    cadence: "weekly",
    weekday: 2,
    start_local: "19:00",
    duration_minutes: 180,
    recurrence_label: "Every Tuesday",
    title: "Open Jam at Gallery Cabaret",
    tagline: "House gear, open list, Bucktown.",
    description:
      "A Gallery Cabaret tradition: the house backline is open to all comers. Sign in with your name and the instruments you play, and you go up with whoever else is on the list. Free entry, Bucktown dive-bar stage that has been running live music seven nights a week since 1988.",
    kind: "open_mic",
    creative_category: "music",
    venue_name: "Gallery Cabaret",
    venue_address: "2020 N Oakley Ave, Chicago, IL 60647",
    external_url: "https://www.gallerycabaret.com/",
    external_organizer: "Gallery Cabaret",
    source_note: "gallerycabaret.com — weekly schedule block plus calendar entries listing Open Jam Tuesdays 7:00 PM.",
  },
  {
    key: "chi_gallery_cabaret_open_mic",
    cadence: "weekly",
    weekday: 4,
    start_local: "20:00",
    duration_minutes: 180,
    recurrence_label: "Every Thursday",
    title: "Open Mic at Gallery Cabaret",
    tagline: "Three-song sets. List goes out 30 minutes before.",
    description:
      "The Gallery's longest-running night. Talent at every level plays three-song sets — solo acts, duos, trios, poetry and track acts all welcome. The sign-up list goes out 30 minutes before the 8:00pm start.",
    kind: "open_mic",
    creative_category: "music",
    venue_name: "Gallery Cabaret",
    venue_address: "2020 N Oakley Ave, Chicago, IL 60647",
    external_url: "https://www.gallerycabaret.com/",
    external_organizer: "Gallery Cabaret",
    source_note: "gallerycabaret.com — 'THURSDAY … Thursday: 8 PM', confirmed by calendar entries.",
  },
  {
    key: "chi_coles_comedy_open_mic",
    cadence: "weekly",
    weekday: 3,
    start_local: "20:00",
    duration_minutes: 150,
    recurrence_label: "Every Wednesday",
    title: "Comedy Open Mic at Cole's Bar",
    tagline: "Free, 21+, 8pm every Wednesday in Logan Square.",
    description:
      "One of the city's staple stand-up mics, running weekly at Cole's in Logan Square. Free to watch, 21 and over, show at 8:00pm. Check Cole's listing for that week's sign-up details.",
    kind: "open_mic",
    creative_category: "writing",
    venue_name: "Cole's Bar",
    venue_address: "2338 N Milwaukee Ave, Chicago, IL 60647",
    external_url: "https://www.colesbarchicago.com/",
    external_organizer: "Cole's Bar",
    source_note: "colesbarchicago.com — Comedy Open Mic listed every Wednesday, 'Show: 8 pm', 'Free', 'Ages 21 and up'.",
  },
  {
    key: "chi_hungry_brain_sunday_transmission",
    cadence: "weekly",
    weekday: 0,
    start_local: "21:00",
    duration_minutes: 180,
    recurrence_label: "Every Sunday",
    title: "Sunday Transmission at the Hungry Brain",
    tagline: "Jazz and improvised music, 9pm Sundays since 2001.",
    description:
      "The Hungry Brain's Sunday Transmission has presented jazz and improvised music every week since January 2001, when Mike Reed and Josh Berman began hosting it. It remains a home stage for Chicago improvisers and a stop for visiting ones. Shows start at 9:00pm; cover is typically $15 at the door.",
    kind: "listening_party",
    creative_category: "music",
    venue_name: "The Hungry Brain",
    venue_address: "2319 W Belmont Ave, Chicago, IL 60618",
    external_url: "https://hungrybrainchicago.com/",
    external_organizer: "The Hungry Brain",
    source_note: "hungrybrainchicago.com — about page plus weekly Sunday calendar entries at 9:00PM, $15.",
  },
  {
    key: "chi_platform_studios_figure_drawing",
    cadence: "weekly",
    weekday: 2,
    start_local: "19:00",
    duration_minutes: 150,
    recurrence_label: "Every Tuesday (also Wed & Thu)",
    title: "Drop-In Figure Drawing at Platform Studios",
    tagline: "Live model, 7–9:30pm, $20 drop-in.",
    description:
      "Platform Studios runs live-model figure drawing three nights a week — Tuesday, Wednesday and Thursday, 7:00–9:30pm. Doors at 6:40pm; space is first come, first served. $20 drop-in, all skill levels. Easels, horses and drawing boards are provided; bring your own drawing supplies.",
    kind: "workshop_irl",
    creative_category: "visual_art",
    venue_name: "Platform Studios",
    venue_address: "1821 W Hubbard St #301, Chicago, IL 60622",
    external_url: "https://www.platformchicago.com/figure-drawing-sessions",
    external_organizer: "Platform Studios",
    source_note:
      "platformchicago.com/figure-drawing-sessions — 'every Tuesday, Wednesday and Thursday evening from 7:00pm-9:30pm', '$20 drop-in'.",
  },
  {
    key: "chi_green_mill_uptown_poetry_slam",
    cadence: "dated",
    occurrences: ["2026-08-16T15:00", "2026-09-20T15:00"],
    duration_minutes: 120,
    recurrence_label: "Selected Sundays",
    title: "Uptown Poetry Slam at the Green Mill",
    tagline: "The original slam, 3–5pm, $10 at the door.",
    description:
      "The Green Mill's Uptown Poetry Slam is the room the poetry slam was invented in. Sunday afternoon sessions run 3:00–5:00pm with a $10 cover. Dates come straight from the Green Mill calendar — check it before you go, since the room does not run the slam every single Sunday.",
    kind: "other",
    creative_category: "writing",
    venue_name: "Green Mill Cocktail Lounge",
    venue_address: "4802 N Broadway Ave, Chicago, IL 60640",
    external_url: "https://greenmilljazz.com/calendar/",
    external_organizer: "Green Mill Cocktail Lounge",
    source_note: "greenmilljazz.com calendar — '(3pm - 5pm) UPTOWN POETRY SLAM', $10 cover, dates listed individually.",
  },
];

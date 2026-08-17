/**
 * Canonical Workshop venue registry.
 *
 * A "Workshop venue" is an INTERNAL classification: a place Workshop has
 * reviewed as potentially suitable for small, informal, hostless gatherings
 * using ordinary public seating. It does NOT mean partnership, sponsorship,
 * reservation, staff coordination, or endorsement. Never render a public
 * "Workshop venue" badge — Workshop is always the organizer and the venue is
 * only the meeting place.
 *
 * The Event row remains authoritative for an occurrence's location snapshot
 * (venue_name / venue_address / venue_lat / venue_lng / venue_city_id). This
 * registry only supplies reusable policy context, keyed by
 * `group_events.workshop_venue_key`.
 *
 * Unknown metadata stays `null`. Uncertainty is never converted into an
 * invented policy, capacity, or source URL.
 */

export type WorkshopVenue = {
  /** Stable internal key persisted on `group_events.workshop_venue_key`. */
  key: string;
  venue_name: string;
  address: string;
  neighborhood: string;
  venue_type: string;
  is_workshop_venue: boolean;
  is_open_house_home_base: boolean;
  /** `null` when the venue's walk-in suitability is genuinely unknown. */
  walk_in_supported: boolean | null;
  walk_in_policy_verified: boolean;
  /**
   * Published point at which the venue directs groups into a reservation,
   * contact, or "Host an Event" flow. NOT the venue's physical capacity.
   * `null` when no such threshold is published.
   */
  group_policy_trigger: number | null;
  reservation_policy_note: string | null;
  age_policy: string | null;
  food_note: string | null;
  wifi: boolean | null;
  indoor_outdoor: string | null;
  /** Internal scheduling guidance — never rendered publicly. */
  scheduling_note: string | null;
  source_url: string | null;
  /** Date the policy was actually verified (not code creation time). */
  policy_last_verified_at: string | null;
  active: boolean;
  /** Concise internal suitability note shown only in the admin picker. */
  internal_note: string;
  /** Known coordinates, when verified. */
  lat: number | null;
  lng: number | null;
};

export const WORKSHOP_VENUES: readonly WorkshopVenue[] = Object.freeze([
  {
    key: "chi_off_color_mousetrap",
    venue_name: "Off Color Brewing — Mousetrap",
    address: "1460 N Kingsbury St, Chicago, IL 60642",
    neighborhood: "Lincoln Park / North Branch",
    venue_type: "Brewery taproom",
    is_workshop_venue: true,
    is_open_house_home_base: true,
    walk_in_supported: true,
    walk_in_policy_verified: true,
    group_policy_trigger: null,
    reservation_policy_note:
      "First-come, first-served. Off Color does not take reservations or hold tables. Larger groups can contact the taproom on some weekdays, but Friday–Sunday seating is entirely first-come; small weekend groups can find seating together as space opens up.",
    age_policy: "21+ after 6 PM",
    food_note: "No kitchen — outside food is welcome",
    wifi: true,
    indoor_outdoor: "Indoor taproom with seasonal outdoor areas and multiple seating sections",
    scheduling_note:
      "Check current taproom hours and existing programming before publishing. Chicago home base and highest-priority fallback.",
    source_url: "https://www.offcolorbrewing.com/mousetrap",
    policy_last_verified_at: "2026-08-17",
    active: true,
    internal_note: "Chicago home base. First-come seating, no published group maximum.",
    lat: 41.9083,
    lng: -87.6527,
  },
  {
    key: "chi_goose_island_fulton",
    venue_name: "Goose Island — Fulton Street Taproom",
    address: "1800 W Fulton St, Chicago, IL 60612",
    neighborhood: "West Town / Fulton Market edge",
    venue_type: "Brewery taproom",
    is_workshop_venue: true,
    is_open_house_home_base: false,
    walk_in_supported: true,
    walk_in_policy_verified: true,
    group_policy_trigger: null,
    reservation_policy_note:
      "No ordinary reservations — visitors are instructed to walk in. Private events are a separate optional flow and are not ordinary public taproom use.",
    age_policy: null,
    food_note: "Snacks available",
    wifi: null,
    indoor_outdoor: null,
    scheduling_note:
      "Currently closed Mondays and Tuesdays. Schedule only against current hours and existing programming.",
    source_url: "https://www.gooseisland.com/pages/fulton-street-taproom",
    policy_last_verified_at: "2026-08-17",
    active: true,
    internal_note: "West Town / Fulton Market coverage. Walk-in only; closed Mon–Tue.",
    lat: 41.8866,
    lng: -87.6721,
  },
  {
    key: "chi_cara_cara_club",
    venue_name: "Cara Cara Club",
    address: "2545 N Kedzie Blvd, Chicago, IL 60647",
    neighborhood: "Logan Square",
    venue_type: "Bar / social space",
    is_workshop_venue: true,
    is_open_house_home_base: false,
    walk_in_supported: true,
    walk_in_policy_verified: true,
    group_policy_trigger: null,
    reservation_policy_note:
      "Ordinary visits are first-come, first-served and need no reservation. Groups of 10–20 may optionally reserve Sunday–Thursday; Friday and Saturday are explicitly first-come. The optional reservation is a capability, not a requirement.",
    age_policy: "21+ only",
    food_note: "Bar bites and shareable food available",
    wifi: null,
    indoor_outdoor: "Bar seating, ledges, standing and mingling room, seasonal patio",
    scheduling_note:
      "Best for adult evening Open Houses. Check programming and anticipated crowd conditions.",
    source_url: "https://www.caracara.club/",
    policy_last_verified_at: "2026-08-17",
    active: true,
    internal_note: "Logan Square evening / social. Optional 10–20 weekday reservation only.",
    lat: 41.9277,
    lng: -87.7069,
  },
  {
    key: "chi_half_acre_balmoral",
    venue_name: "Half Acre Beer — Balmoral",
    address: "2050 W Balmoral Ave, Chicago, IL 60625",
    neighborhood: "Bowmanville / North Side",
    venue_type: "Brewery taproom and beer garden",
    is_workshop_venue: true,
    is_open_house_home_base: false,
    walk_in_supported: true,
    walk_in_policy_verified: true,
    group_policy_trigger: 10,
    reservation_policy_note:
      "Half Acre does not currently offer ordinary reservations. Groups of 10 or more are directed into the Host an Event flow.",
    age_policy: "Children permitted in the taproom and beer garden with an adult 21 or older",
    food_note: null,
    wifi: null,
    indoor_outdoor: "Indoor taproom and seasonal beer garden",
    scheduling_note:
      "Use ordinary public seating only for deliberately small Open Houses. If maximum accepted RSVPs reach 10, require admin review or confirmation through the venue's event-hosting flow.",
    source_url: "https://halfacrebeer.com/pages/balmoral",
    policy_last_verified_at: "2026-08-17",
    active: true,
    internal_note: "Small North Side Open Houses. Group-policy trigger at 10 (not capacity).",
    lat: 41.9797,
    lng: -87.6807,
  },
  {
    key: "chi_solemn_oath_still_life",
    venue_name: "Solemn Oath Brewery — Still Life",
    address: "2919 W Armitage Ave, Chicago, IL 60647",
    neighborhood: "Logan Square",
    venue_type: "Brewery taproom / neighborhood bar",
    is_workshop_venue: true,
    is_open_house_home_base: false,
    walk_in_supported: null,
    walk_in_policy_verified: false,
    group_policy_trigger: null,
    reservation_policy_note:
      "The official site confirms the venue and its event-hosting path, but does not provide the explicit small-group walk-in language available for the other verified venues.",
    age_policy: null,
    food_note: "Regular food pop-ups",
    wifi: null,
    indoor_outdoor: "Large taproom with communal and social seating",
    scheduling_note:
      "Requires one-time admin confirmation before any unattended recurring automation. Do not manufacture a no-reservation or first-come policy.",
    source_url: "https://www.solemnoathbrewery.com/",
    policy_last_verified_at: null,
    active: true,
    internal_note: "Logan Square coverage pending walk-in verification. Review required.",
    lat: 41.9174,
    lng: -87.7013,
  },
  {
    key: "chi_begyle_brewing",
    venue_name: "Begyle Brewing",
    address: "1800 W Cuyler Ave, Chicago, IL 60613",
    neighborhood: "Ravenswood Industrial Corridor / Malt Row",
    venue_type: "Brewery taproom",
    is_workshop_venue: true,
    is_open_house_home_base: false,
    walk_in_supported: true,
    walk_in_policy_verified: true,
    group_policy_trigger: 15,
    reservation_policy_note:
      "Small groups are explicitly walk-in and first-come. Groups under 15 are encouraged to stop by; groups of 15 or more enter the reservation flow.",
    age_policy: null,
    food_note: null,
    wifi: null,
    indoor_outdoor: null,
    scheduling_note:
      "If maximum accepted RSVPs reach 15, require admin review or confirmation through the venue reservation flow. Begyle programs work-from-the-taproom and other community activities.",
    source_url: "https://www.begylebrewing.com/",
    policy_last_verified_at: "2026-08-17",
    active: true,
    internal_note: "Highest-confidence automated venue. Reservation trigger at 15 (not capacity).",
    lat: 41.9573,
    lng: -87.6742,
  },
  {
    key: "chi_district_brew_yards_west_loop",
    venue_name: "District Brew Yards — West Loop",
    address: "417 N Ashland Ave, Chicago, IL 60622",
    neighborhood: "West Loop",
    venue_type: "Self-pour brewery / open beer hall",
    is_workshop_venue: true,
    is_open_house_home_base: false,
    walk_in_supported: true,
    walk_in_policy_verified: true,
    group_policy_trigger: null,
    reservation_policy_note:
      "Ordinary seating is first-come, first-served; the venue does not take ordinary reservations and tells customers to come in. Groups are explicitly welcome, with large communal and casual seating. Groups of roughly 10–20 may optionally reserve a casual gathering space — an option, not a requirement.",
    age_policy: "21+",
    food_note: "On-site kitchen; outside food is generally not permitted",
    wifi: null,
    indoor_outdoor: "Large communal indoor beer hall",
    scheduling_note:
      "Check current hours and programming before each occurrence. Pour-your-own with individual digital payment suits hostless events well.",
    source_url: "https://districtbrewyards.com/",
    policy_last_verified_at: "2026-08-17",
    active: true,
    internal_note: "Self-pour, individual payment — strong for hostless events. No hard trigger.",
    lat: 41.8893,
    lng: -87.6672,
  },
  {
    key: "chi_marz_mothership",
    venue_name: "Marz Community Brewing — Mothership",
    address: "3630 S Iron St, Chicago, IL 60609",
    neighborhood: "McKinley Park",
    venue_type: "Brewery taproom / community-oriented cultural space",
    is_workshop_venue: true,
    is_open_house_home_base: false,
    walk_in_supported: true,
    walk_in_policy_verified: true,
    group_policy_trigger: 10,
    reservation_policy_note:
      "Marz does not currently offer ordinary reservations. Groups of 10 or more are directed into the Host an Event flow.",
    age_policy: "Children permitted in the taproom and beer garden with an adult 21 or older",
    food_note: null,
    wifi: null,
    indoor_outdoor: "Taproom and seasonal beer garden",
    scheduling_note:
      "If maximum accepted RSVPs reach 10, require admin review or confirmation through the venue's Host an Event flow. Mothership hosts recurring public programming (Puzzled Pint, trivia, game nights).",
    source_url: "https://marzbrewing.com/",
    policy_last_verified_at: "2026-08-17",
    active: true,
    internal_note: "Primary South Side venue. Group-policy trigger at 10 (not capacity).",
    lat: 41.8281,
    lng: -87.6552,
  },
  {
    key: "chi_long_room",
    venue_name: "Long Room",
    address: "1612 W Irving Park Rd, Chicago, IL 60613",
    neighborhood: "North Center",
    venue_type: "Bar with cafe-style room",
    is_workshop_venue: true,
    is_open_house_home_base: false,
    walk_in_supported: true,
    walk_in_policy_verified: false,
    group_policy_trigger: null,
    reservation_policy_note:
      "No ordinary reservations for small groups; ordinary seating is first-come.",
    age_policy: null,
    food_note: null,
    wifi: null,
    indoor_outdoor: "Indoor room with long communal seating",
    scheduling_note: "Morning and early afternoon coverage on the North Side.",
    source_url: null,
    policy_last_verified_at: null,
    active: true,
    internal_note: "Daytime North Side co-working option. Confirm walk-in language before automating.",
    lat: 41.9541,
    lng: -87.669,
  },
  {
    key: "chi_life_on_marz",
    venue_name: "Life on Marz Community Club",
    address: "3040 W Armitage Ave, Chicago, IL 60647",
    neighborhood: "Logan Square",
    venue_type: "Bar / community club",
    is_workshop_venue: true,
    is_open_house_home_base: false,
    walk_in_supported: true,
    walk_in_policy_verified: false,
    group_policy_trigger: null,
    reservation_policy_note: "No ordinary reservations for small groups.",
    age_policy: "21+ in the evening",
    food_note: null,
    wifi: null,
    indoor_outdoor: "Indoor bar room",
    scheduling_note: "Frequent evening programming — verify the calendar before publishing.",
    source_url: null,
    policy_last_verified_at: null,
    active: true,
    internal_note: "Late afternoon and selected evenings only.",
    lat: 41.9174,
    lng: -87.704,
  },
  {
    key: "chi_waterfront_cafe",
    venue_name: "Waterfront Café",
    address: "2800 W Lake Shore Dr, Chicago, IL 60657",
    neighborhood: "Lakefront",
    venue_type: "Seasonal lakefront café",
    is_workshop_venue: true,
    is_open_house_home_base: false,
    walk_in_supported: true,
    walk_in_policy_verified: false,
    group_policy_trigger: null,
    reservation_policy_note: "Seasonal, walk-in only.",
    age_policy: null,
    food_note: null,
    wifi: null,
    indoor_outdoor: "Seasonal outdoor lakefront seating",
    scheduling_note: "Warm months only. No outlets — schedule for offline work.",
    source_url: null,
    policy_last_verified_at: null,
    active: true,
    internal_note: "Seasonal morning/afternoon option. Outdoors, no power.",
    lat: 41.933,
    lng: -87.638,
  },
  {
    key: "chi_obama_center_cafe",
    venue_name: "Obama Presidential Center Café",
    address: "5235 S Cornell Dr, Chicago, IL 60615",
    neighborhood: "Jackson Park",
    venue_type: "Museum café",
    is_workshop_venue: false,
    is_open_house_home_base: false,
    walk_in_supported: null,
    walk_in_policy_verified: false,
    group_policy_trigger: null,
    reservation_policy_note: "Public café seating; no reservations.",
    age_policy: null,
    food_note: null,
    wifi: null,
    indoor_outdoor: null,
    scheduling_note: "Scout later — too busy for dependable recurring Co-working.",
    source_url: null,
    policy_last_verified_at: null,
    active: false,
    internal_note: "Scout later. Small trial only; excluded from rotation.",
    lat: 41.793,
    lng: -87.586,
  },
]);


/** Home base first, then the rotation venues in registry order. */
export function listWorkshopVenues(): WorkshopVenue[] {
  return WORKSHOP_VENUES.filter((v) => v.active).sort(
    (a, b) => Number(b.is_open_house_home_base) - Number(a.is_open_house_home_base),
  );
}

export function getWorkshopVenue(key: string | null | undefined): WorkshopVenue | null {
  if (!key) return null;
  return WORKSHOP_VENUES.find((v) => v.key === key) ?? null;
}

export function isWorkshopVenueKey(key: string | null | undefined): boolean {
  return !!getWorkshopVenue(key);
}

// ------------------------------------------------------------------ public --

/**
 * The only venue metadata that may ever reach a public surface. Internal
 * classification, verification state, automation eligibility, group triggers,
 * scheduling warnings and confirmation state are deliberately excluded.
 */
export type PublicVenueDetails = {
  venue_name: string;
  neighborhood: string;
  venue_type: string;
  address: string;
  seating_note: string | null;
  age_policy: string | null;
  food_note: string | null;
  wifi: boolean | null;
  indoor_outdoor: string | null;
  website: string | null;
};

export const VENUE_PUBLIC_DISCLAIMER =
  "Workshop organizes this gathering using the venue's ordinary public seating. The venue is the meeting place and is not a sponsor or organizer unless stated otherwise.";

export const HOSTLESS_OPEN_HOUSE_NOTE =
  "There is no formal host or reserved Workshop table. At event time, open Now to check in and find where the group is sitting. If you arrive first, choose an easy-to-find public seat and tell the room where you are.";

export function publicVenueDetails(key: string | null | undefined): PublicVenueDetails | null {
  const v = getWorkshopVenue(key);
  if (!v || !v.active) return null;
  return {
    venue_name: v.venue_name,
    neighborhood: v.neighborhood,
    venue_type: v.venue_type,
    address: v.address,
    // Public seating language only — never the internal group trigger.
    seating_note: v.walk_in_supported === true ? "Seating is first-come, first-served." : null,
    age_policy: v.age_policy,
    food_note: v.food_note,
    wifi: v.wifi,
    indoor_outdoor: v.indoor_outdoor,
    website: v.source_url,
  };
}

// ------------------------------------------------------------------ policy --

export type VenuePolicyStatus =
  | "eligible"
  | "requires_review"
  | "walk_in_unverified"
  | "group_trigger_reached";

export type VenuePolicyResult = {
  status: VenuePolicyStatus;
  /** True when unattended automated publication needs a human decision. */
  requiresReview: boolean;
  /** Short internal explanation for the admin composer. */
  reason: string | null;
  /** capacity + overflow, or null when capacity is unset. */
  maxRsvps: number | null;
};

/** capacity + overflow. Null capacity means no finite ceiling. */
export function maxRsvps(
  capacity: number | null | undefined,
  overflow: number | null | undefined,
): number | null {
  if (capacity == null) return null;
  return capacity + Math.max(0, overflow ?? 0);
}

/**
 * Evaluate an occurrence's calculated maximum against the canonical venue's
 * published policy. This never reduces capacity or overflow — it only reports.
 * A human admin may intentionally proceed after confirming the venue's
 * appropriate flow (`confirmed: true`), which is stored per occurrence.
 */
export function evaluateVenuePolicy(input: {
  key: string | null | undefined;
  capacity: number | null | undefined;
  overflow: number | null | undefined;
  confirmed?: boolean;
}): VenuePolicyResult {
  const max = maxRsvps(input.capacity, input.overflow);
  const venue = getWorkshopVenue(input.key);
  if (!venue) return { status: "eligible", requiresReview: false, reason: null, maxRsvps: max };

  const confirmed = input.confirmed === true;

  if (!venue.walk_in_policy_verified || venue.walk_in_supported == null) {
    return {
      status: "walk_in_unverified",
      requiresReview: !confirmed,
      reason: `${venue.venue_name}'s walk-in policy is not verified. Unattended publication requires admin review.`,
      maxRsvps: max,
    };
  }

  if (venue.group_policy_trigger != null && max != null && max >= venue.group_policy_trigger) {
    return {
      status: "group_trigger_reached",
      requiresReview: !confirmed,
      reason: `Up to ${max} accepted RSVPs reaches ${venue.venue_name}'s published group policy trigger of ${venue.group_policy_trigger}. Confirm through the venue's reservation or Host an Event flow before publishing.`,
      maxRsvps: max,
    };
  }

  return { status: "eligible", requiresReview: false, reason: null, maxRsvps: max };
}

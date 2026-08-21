/**
 * Open House application vocabulary. Kept out of the server-function module so
 * client routes can import these constants without pulling in server code.
 */

export const OPEN_HOUSE_STATUSES = [
  "new",
  "reviewing",
  "shortlisted",
  "contacted",
  "booked",
  "declined",
  "archived",
] as const;
export type OpenHouseStatus = (typeof OPEN_HOUSE_STATUSES)[number];

export const OPEN_HOUSE_STATUS_LABELS: Record<OpenHouseStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  shortlisted: "Shortlisted",
  contacted: "Contacted",
  booked: "Booked",
  declined: "Declined",
  archived: "Archived",
};

/**
 * Partner taxonomy. Open House is more than talent — vendors, brands, and
 * hosts are first-class partners. Deliberately separate from the Field
 * taxonomy used elsewhere on Workshop.
 */
export const PARTNER_TYPES = [
  { id: "host", label: "Host", hint: "MC or run the room" },
  { id: "performance", label: "Performance", hint: "DJ, band, comedian, and more" },
  { id: "listening_party", label: "Listening party", hint: "Album or project playback" },
  { id: "screening", label: "Screening", hint: "Film, video, or work-in-progress" },
  { id: "talk_reading", label: "Talk or reading", hint: "Lecture, panel, poetry, prose" },
  { id: "workshop_demo", label: "Workshop or demonstration", hint: "Teach or show a process" },
  { id: "art_vendor", label: "Art or craft vendor", hint: "Table, prints, goods" },
  { id: "food_vendor", label: "Food vendor", hint: "Food, drink, catering partner" },
  { id: "brand", label: "Brand or sponsor", hint: "Product, activation, support" },
  { id: "other", label: "Something else", hint: "Tell us what you have in mind" },
] as const;
export type PartnerType = (typeof PARTNER_TYPES)[number]["id"];
export const PARTNER_TYPE_IDS = PARTNER_TYPES.map((p) => p.id) as unknown as [
  PartnerType,
  ...PartnerType[],
];

export function partnerTypeLabel(id: string): string {
  return PARTNER_TYPES.find((p) => p.id === id)?.label ?? legacyProgramTypeLabel(id);
}

/** Sub-type popout shown only when "Performance" is chosen. */
export const PERFORMANCE_SUBTYPES = [
  { id: "dj", label: "DJ" },
  { id: "band", label: "Band" },
  { id: "solo_musician", label: "Solo musician" },
  { id: "comedian", label: "Comedian" },
  { id: "dancer", label: "Dancer" },
  { id: "poet", label: "Poet or spoken word" },
  { id: "theater", label: "Theater or improv" },
  { id: "other", label: "Something else" },
] as const;
export type PerformanceSubtype = (typeof PERFORMANCE_SUBTYPES)[number]["id"];
export const PERFORMANCE_SUBTYPE_IDS = PERFORMANCE_SUBTYPES.map((p) => p.id) as unknown as [
  PerformanceSubtype,
  ...PerformanceSubtype[],
];

export function performanceSubtypeLabel(id: string | null): string | null {
  if (!id) return null;
  return PERFORMANCE_SUBTYPES.find((p) => p.id === id)?.label ?? id;
}

/** Partners who bring a table or an activation rather than a timed slot. */
export const VENDOR_PARTNER_TYPES: readonly string[] = ["art_vendor", "food_vendor", "brand"];

export function isVendorPartner(id: string): boolean {
  return VENDOR_PARTNER_TYPES.includes(id);
}

/**
 * Legacy program types. Kept so historical rows still render a sensible label.
 * New applications write `partner_type`.
 */
const LEGACY_PROGRAM_TYPE_LABELS: Record<string, string> = {
  live_music: "Band or live music",
  dj_set: "DJ set",
  performance: "Performance",
  talk: "Talk or lecture",
  reading: "Reading",
  screening: "Screening",
  demonstration: "Demonstration or workshop",
  other: "Something else",
};

export function legacyProgramTypeLabel(id: string): string {
  return LEGACY_PROGRAM_TYPE_LABELS[id] ?? id;
}

/** @deprecated use partnerTypeLabel */
export const programTypeLabel = partnerTypeLabel;

export const LENGTH_OPTIONS = [
  { id: "under_15", label: "Under 15 minutes" },
  { id: "15_30", label: "15–30 minutes" },
  { id: "30_60", label: "30–60 minutes" },
  { id: "over_60", label: "More than 60 minutes" },
  { id: "flexible", label: "Flexible" },
] as const;
export type LengthOption = (typeof LENGTH_OPTIONS)[number]["id"];
export const LENGTH_IDS = LENGTH_OPTIONS.map((l) => l.id) as unknown as [
  LengthOption,
  ...LengthOption[],
];

export function lengthLabel(id: string | null): string | null {
  if (!id) return null;
  return LENGTH_OPTIONS.find((l) => l.id === id)?.label ?? id;
}

export const PROPOSAL_MIN = 40;
export const PROPOSAL_MAX = 3000;

export type OpenHouseApplication = {
  id: string;
  user_id: string | null;
  contact_name: string;
  project_name: string | null;
  email: string;
  /** Legacy column, still written for backwards compatibility. */
  program_type: string;
  partner_type: string;
  performance_subtype: string | null;
  performance_subtype_other: string | null;
  city: string;
  city_id: string | null;
  portfolio_url: string;
  workshop_username: string | null;
  proposal: string;
  approximate_length: string | null;
  setup_needs: string | null;
  marketing_opt_in: boolean;
  wants_account: boolean;
  status: OpenHouseStatus;
  internal_notes: string | null;
  created_at: string;
};

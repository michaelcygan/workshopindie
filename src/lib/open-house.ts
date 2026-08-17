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

/** Proposed program format — deliberately separate from the Field taxonomy. */
export const PROGRAM_TYPES = [
  { id: "live_music", label: "Band or live music" },
  { id: "dj_set", label: "DJ set" },
  { id: "performance", label: "Performance" },
  { id: "talk", label: "Talk or lecture" },
  { id: "reading", label: "Reading" },
  { id: "screening", label: "Screening" },
  { id: "demonstration", label: "Demonstration or workshop" },
  { id: "other", label: "Something else" },
] as const;
export type ProgramType = (typeof PROGRAM_TYPES)[number]["id"];
export const PROGRAM_TYPE_IDS = PROGRAM_TYPES.map((p) => p.id) as unknown as [
  ProgramType,
  ...ProgramType[],
];

export function programTypeLabel(id: string): string {
  return PROGRAM_TYPES.find((p) => p.id === id)?.label ?? id;
}

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
  program_type: string;
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

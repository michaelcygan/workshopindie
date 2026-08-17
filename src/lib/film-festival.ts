/**
 * Workshop Film Festival vocabulary. Kept out of the server-function module so
 * client routes can import these constants without pulling in server code.
 */

export const FILM_STATUSES = [
  "new",
  "reviewing",
  "shortlisted",
  "selected",
  "programmed",
  "declined",
  "archived",
] as const;
export type FilmStatus = (typeof FILM_STATUSES)[number];

export const FILM_STATUS_LABELS: Record<FilmStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  shortlisted: "Shortlisted",
  selected: "Selected",
  programmed: "Programmed",
  declined: "Declined",
  archived: "Archived",
};

export const FILM_FORMATS = [
  { id: "short", label: "Short film" },
  { id: "feature", label: "Feature" },
  { id: "documentary", label: "Documentary" },
  { id: "experimental", label: "Experimental" },
  { id: "animation", label: "Animation" },
  { id: "music_video", label: "Music video" },
  { id: "series", label: "Series or episode" },
  { id: "other", label: "Something else" },
] as const;
export type FilmFormat = (typeof FILM_FORMATS)[number]["id"];
export const FILM_FORMAT_IDS = FILM_FORMATS.map((f) => f.id) as unknown as [
  FilmFormat,
  ...FilmFormat[],
];

export function filmFormatLabel(id: string): string {
  return FILM_FORMATS.find((f) => f.id === id)?.label ?? id;
}

export const LOGLINE_MAX = 280;
export const SYNOPSIS_MIN = 40;
export const SYNOPSIS_MAX = 3000;

export type FilmFestivalSubmission = {
  id: string;
  user_id: string | null;
  contact_name: string;
  email: string;
  film_title: string;
  workshop_username: string | null;
  city: string;
  city_id: string | null;
  film_format: string;
  runtime_minutes: number | null;
  completion_year: number | null;
  trailer_url: string;
  film_url: string | null;
  access_notes: string | null;
  logline: string;
  synopsis: string | null;
  credits: string | null;
  rights_confirmed: boolean;
  marketing_opt_in: boolean;
  wants_account: boolean;
  status: FilmStatus;
  internal_notes: string | null;
  created_at: string;
};

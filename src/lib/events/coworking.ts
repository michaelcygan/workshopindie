/**
 * Workshop Co-working — the vocabulary and the copy.
 *
 * Co-working is a `group_event_kind`, not a separate object. Everything here
 * is the shared language the composer, the flyer and discovery all read from,
 * so a session never describes itself two different ways.
 *
 * The program's whole promise is small: Workshop publishes the session, limits
 * the group, explains the venue arrangement, says what to bring, helps people
 * find each other, absorbs RSVP attrition, records who arrived, and gives the
 * work somewhere to continue. Nothing here should imply staff, a reservation,
 * or a host who runs the room.
 */

export const COWORKING_KIND = "coworking" as const;
export const COWORKING_PROGRAM_NAME = "Workshop Co-working";
export const COWORKING_LABEL = "Co-working";

// ------------------------------------------------------------------ daypart --

export const DAYPARTS = ["morning", "afternoon", "evening"] as const;
export type Daypart = (typeof DAYPARTS)[number];
export type DaypartFilter = "all" | Daypart;

const DAYPART_LABELS: Record<Daypart, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

export function isDaypart(v: string | null | undefined): v is Daypart {
  return !!v && (DAYPARTS as readonly string[]).includes(v);
}

export function daypartLabel(v: string | null | undefined): string {
  return isDaypart(v) ? DAYPART_LABELS[v] : "Any time of day";
}

export const DAYPART_OPTIONS: { value: DaypartFilter; label: string }[] = [
  { value: "all", label: "Any time of day" },
  ...DAYPARTS.map((d) => ({ value: d as DaypartFilter, label: DAYPART_LABELS[d] })),
];

/** Local-time windows the rotation builder schedules into. */
export const DAYPART_WINDOWS: Record<Daypart, { startHour: number; hours: number }> = {
  morning: { startHour: 9, hours: 3 },
  afternoon: { startHour: 14, hours: 3 },
  evening: { startHour: 18, hours: 3 },
};

/** Derive a daypart from an occurrence's local start hour. */
export function daypartFromDate(date: Date): Daypart {
  const h = date.getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

// ----------------------------------------------------------------- activity --

export const COWORKING_ACTIVITIES = [
  "writing",
  "laptop",
  "reading",
  "research",
  "study",
  "sketching",
  "handwork",
  "contained_art",
] as const;
export type CoworkingActivity = (typeof COWORKING_ACTIVITIES)[number];

const ACTIVITY_LABELS: Record<CoworkingActivity, string> = {
  writing: "Writing",
  laptop: "Laptop work",
  reading: "Reading",
  research: "Research",
  study: "Studying",
  sketching: "Sketching",
  handwork: "Quiet handwork",
  contained_art: "Small, contained art supplies",
};

export function activityLabel(v: string): string {
  return (ACTIVITY_LABELS as Record<string, string>)[v] ?? v.replace(/_/g, " ");
}

export const ACTIVITY_OPTIONS = COWORKING_ACTIVITIES.map((a) => ({
  value: a,
  label: ACTIVITY_LABELS[a],
}));

export const DEFAULT_COWORKING_ACTIVITIES: CoworkingActivity[] = [
  "writing",
  "laptop",
  "reading",
  "research",
  "sketching",
];

// --------------------------------------------------------------------- copy --

export const COWORKING_SESSION_NOTE =
  "This is a quiet working session. People work on their own thing, side by side. There is no presentation, no critique round and no agenda — arrive, find the group, work, and leave when you need to.";

export const COWORKING_HOSTLESS_NOTE =
  "There is no host and no reserved table. Workshop uses the venue's ordinary public seating, so seating is first come, first served. Whoever arrives first picks an easy-to-find spot and posts it on the Wall.";

export const COWORKING_FIRST_COME_NOTE =
  "Seating is first come, first served. The venue is the meeting place, not a sponsor or organizer, and nothing is held for the group.";

export const COWORKING_BRING_NOTE =
  "Bring what you're working on and whatever power you need. Plan to buy something — it's how these rooms stay open to us.";

export const COWORKING_ATTRITION_NOTE =
  "A few more RSVPs are accepted than the group size, because some people can't make it. If you can't come, mark it — it opens the seat for someone else.";

export const COWORKING_NOTE_PROMPT = "What are you working on?";
export const COWORKING_NOTE_PLACEHOLDER = "A short line — 'finishing a grant draft', 'storyboarding'…";

// ------------------------------------------------------- writing sessions --

/**
 * Workshop Writing Co-working. Writing is the only medium: a notebook or a
 * laptop is a tool, not a separate activity. Everything here is the copy the
 * program materializer, the composer defaults and the public panel share, so
 * a writing session never describes itself as general co-working.
 */
export const WRITING_COWORKING_PROGRAM_KEY = "writing_coworking";
export const WRITING_COWORKING_NAME = "Workshop Writing Co-working";

export const WRITING_COWORKING_TAGLINE =
  "Bring something to write. Work quietly alongside other writers.";

export const WRITING_COWORKING_DESCRIPTION =
  "A quiet, small-group writing session. Bring a notebook, laptop, draft, research notes, or an unfinished idea. Write independently alongside other writers. There is no critique, reading, presentation, or required conversation. Drop in, find the group, buy something from the venue, and work for as long as you like.";

export const WRITING_SESSION_HEADING = "A quiet writing session";

export const WRITING_SESSION_NOTE =
  "People write independently, side by side. There is no critique round, presentation, or agenda.";

export const WRITING_BRING_NOTE =
  "Bring a notebook or laptop, your draft or notes, and whatever power you need. Plan to buy something from the venue.";

export const WRITING_NOTE_PROMPT = "What are you writing?";
export const WRITING_NOTE_PLACEHOLDER = "Revising chapter three…";

export const WRITING_WALL_SUGGESTION = "Writing today";

/** New Co-working sessions are writing sessions. */
export const WRITING_ONLY_ACTIVITIES: CoworkingActivity[] = ["writing"];

/** True when an occurrence is a writing-only session. */
export function isWritingSession(activities: string[] | null | undefined): boolean {
  const list = (activities ?? []).filter(Boolean);
  return list.length === 1 && list[0] === "writing";
}

/** Defaults the composer applies the moment Co-working is chosen. */
export const COWORKING_DEFAULTS = {
  format: "in_person" as const,
  capacity: 6,
  overflow: 2,
  facilitation: "hostless" as const,
  drop_in_allowed: true,
  waitlist_enabled: true,
  duration_hours: 3,
  tagline: WRITING_COWORKING_TAGLINE,
  description: WRITING_COWORKING_DESCRIPTION,
};

export function coworkingTitle(venueName: string, daypart: Daypart): string {
  return `${COWORKING_PROGRAM_NAME} · ${DAYPART_LABELS[daypart]} at ${venueName}`;
}

/** Title for a Writing Co-working occurrence. */
export function writingCoworkingTitle(venueName: string, daypart: Daypart): string {
  return `${WRITING_COWORKING_NAME} · ${DAYPART_LABELS[daypart]} at ${venueName}`;
}


/** The public power line. Unknown never becomes a promise. */
export function powerNote(power: "likely" | "limited" | "unavailable" | null): string | null {
  if (power === "likely") return "Outlets are usually available, but not guaranteed.";
  if (power === "limited") return "Outlets are limited — come charged.";
  if (power === "unavailable") return "No outlets — come charged.";
  return null;
}

export function wifiNote(wifi: boolean | null): string | null {
  if (wifi === true) return "Wi-Fi available.";
  if (wifi === false) return "No Wi-Fi — plan for a hotspot or offline work.";
  return null;
}

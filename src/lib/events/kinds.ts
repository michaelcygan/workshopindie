/**
 * The one vocabulary for event kinds and attendance.
 *
 * `group_events.kind` is a Postgres enum (`group_event_kind`); this module is
 * its client-safe mirror plus the human labels Workshop shows. Both the admin
 * composer and every discovery surface import from here so a future
 * member-facing composer can never drift from the directory UI.
 */

export const EVENT_KINDS = [
  "open_mic",
  "listening_party",
  "networking",
  "screening",
  "workshop_irl",
  "coworking",
  "online",
  "lineup",
  "hackathon",
  "other",
] as const;

export type EventKind = (typeof EVENT_KINDS)[number];

const KIND_LABELS: Record<EventKind, string> = {
  open_mic: "Open mic",
  listening_party: "Listening party",
  networking: "Networking",
  screening: "Screening",
  workshop_irl: "Workshop",
  coworking: "Co-working",
  online: "Online",
  lineup: "Show / Lineup",
  hackathon: "Hackathon",
  other: "Other",
};


export function isEventKind(value: string | null | undefined): value is EventKind {
  return !!value && (EVENT_KINDS as readonly string[]).includes(value);
}

/** Human label for a stored kind. Unknown/legacy values degrade gracefully. */
export function eventKindLabel(kind: string | null | undefined): string {
  if (!kind) return "Event";
  if (isEventKind(kind)) return KIND_LABELS[kind];
  return kind.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const EVENT_KIND_OPTIONS = EVENT_KINDS.map((k) => ({ value: k, label: KIND_LABELS[k] }));

/**
 * Attendance is the user-facing name for `group_events.format`. "Format"
 * elsewhere in Workshop means creative medium, so the UI never says it here.
 */
export const ATTENDANCE_VALUES = ["in_person", "online", "hybrid"] as const;
export type Attendance = (typeof ATTENDANCE_VALUES)[number];
export type AttendanceFilter = "all" | Attendance;

export function isAttendance(value: string | null | undefined): value is Attendance {
  return !!value && (ATTENDANCE_VALUES as readonly string[]).includes(value);
}

export function attendanceLabel(value: AttendanceFilter): string {
  if (value === "all") return "Any attendance";
  if (value === "in_person") return "In person";
  if (value === "online") return "Online";
  return "Hybrid";
}

export const ATTENDANCE_OPTIONS: { value: AttendanceFilter; label: string }[] = [
  { value: "all", label: "Any attendance" },
  { value: "in_person", label: "In person" },
  { value: "online", label: "Online" },
  { value: "hybrid", label: "Hybrid" },
];

/**
 * Hybrid attends both ways, so it belongs in both broader modes. Only the
 * explicit "hybrid" filter narrows to hybrid alone.
 */
export function matchesAttendance(
  format: string | null | undefined,
  filter: AttendanceFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "hybrid") return format === "hybrid";
  if (filter === "in_person") return format === "in_person" || format === "hybrid";
  return format === "online" || format === "hybrid";
}

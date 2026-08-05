/**
 * Event lifecycle + moment — the single source of truth for "what is this
 * Event right now".
 *
 * Lifecycle (what the host decided):
 *   draft      — not published, private to creator/hosts/admins
 *   published  — a live flyer
 *   archived   — a calm, read-only record
 *   canceled   — called off, still readable
 *
 * Moment (where we are in time, for a published Event):
 *   upcoming   — before starts_at
 *   live       — between starts_at and ends_at
 *   afterglow  — ends_at → ends_at + 24h (participation still open)
 *   archived   — after that
 *
 * Pure + isomorphic: no I/O, injectable `now`, safe in loaders, components,
 * and tests.
 */

export type EventLifecycle = "draft" | "published" | "archived" | "canceled";
export type EventMoment = "upcoming" | "live" | "afterglow" | "archived";

export type LifecycleInput = {
  status?: string | null;
  published_at?: string | Date | null;
  archived_at?: string | Date | null;
  starts_at?: string | Date | null;
  ends_at?: string | Date | null;
  deleted_at?: string | Date | null;
};

/** Participation (Wall, Gallery, check-in receipts) closes 24h after the end. */
export const INTERACTION_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Fallback duration when an Event has no explicit end. */
const DEFAULT_DURATION_MS = 4 * 60 * 60 * 1000;

export function toTime(v: string | Date | null | undefined): number | null {
  if (!v) return null;
  const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Effective end of an Event (explicit ends_at, else start + 4h). */
export function eventEndsAt(ev: LifecycleInput): number | null {
  const end = toTime(ev.ends_at);
  if (end !== null) return end;
  const start = toTime(ev.starts_at);
  return start === null ? null : start + DEFAULT_DURATION_MS;
}

/** The exact instant Wall / Gallery / check-in stop accepting writes. */
export function interactionClosesAt(ev: LifecycleInput): number | null {
  const end = eventEndsAt(ev);
  return end === null ? null : end + INTERACTION_WINDOW_MS;
}

export function getEventLifecycle(ev: LifecycleInput, now: Date = new Date()): EventLifecycle {
  if (ev.status === "canceled") return "canceled";
  const published = toTime(ev.published_at);
  if (published === null || ev.status === "draft") return "draft";
  const archived = toTime(ev.archived_at);
  const t = now.getTime();
  if (archived !== null && archived <= t) return "archived";
  const closes = interactionClosesAt(ev);
  // Time-based archival is authoritative even before the sweep stamps the row.
  if (closes !== null && t >= closes) return "archived";
  return "published";
}

export function getEventMoment(ev: LifecycleInput, now: Date = new Date()): EventMoment {
  const t = now.getTime();
  const start = toTime(ev.starts_at);
  const end = eventEndsAt(ev);
  const closes = interactionClosesAt(ev);
  if (start === null) return "upcoming";
  if (t < start) return "upcoming";
  if (end !== null && t <= end) return "live";
  if (closes !== null && t < closes) return "afterglow";
  return "archived";
}

/** Is the Event currently running? */
export function isEventLive(ev: LifecycleInput, now: Date = new Date()): boolean {
  return getEventLifecycle(ev, now) === "published" && getEventMoment(ev, now) === "live";
}

/** Can participants still post to the Wall / Gallery? */
export function isParticipationOpen(ev: LifecycleInput, now: Date = new Date()): boolean {
  const lc = getEventLifecycle(ev, now);
  if (lc !== "published") return false;
  const closes = interactionClosesAt(ev);
  return closes === null ? false : now.getTime() < closes;
}

/** Can people still RSVP? (Published, not canceled, before the Event ends.) */
export function isRsvpOpen(ev: LifecycleInput, now: Date = new Date()): boolean {
  if (getEventLifecycle(ev, now) !== "published") return false;
  const end = eventEndsAt(ev);
  return end === null ? true : now.getTime() < end;
}

/** Check-in is only possible while the Event is actually running. */
export function isCheckInOpen(ev: LifecycleInput, now: Date = new Date()): boolean {
  return isEventLive(ev, now);
}

/** Should this Event appear in active discovery feeds? */
export function isDiscoverableNow(ev: LifecycleInput, now: Date = new Date()): boolean {
  if (ev.deleted_at) return false;
  if (getEventLifecycle(ev, now) !== "published") return false;
  const end = eventEndsAt(ev);
  return end === null ? true : end > now.getTime();
}

/** Short human label for the flyer status treatment. */
export function eventStatusLabel(ev: LifecycleInput, now: Date = new Date()): string {
  const lc = getEventLifecycle(ev, now);
  if (lc === "canceled") return "Canceled";
  if (lc === "draft") return "Draft";
  if (lc === "archived") return "Archived";
  const moment = getEventMoment(ev, now);
  if (moment === "live") return "Happening now";
  if (moment === "afterglow") return "Posting open for 24 hours";
  return "Upcoming";
}

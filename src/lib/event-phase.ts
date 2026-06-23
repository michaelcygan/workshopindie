/**
 * Pure phase helper for event surfaces.
 *
 * Live window = starts_at − 60min → ends_at + 60min
 * If ends_at is null, defaults to starts_at + 4h (covers most drop-in events).
 *
 * Keep this isomorphic + side-effect free so it can run in loaders,
 * components, and tests with the same shape.
 */
export type EventPhase = "pre" | "live" | "post";

export type PhaseInput = {
  starts_at: string | Date | null | undefined;
  ends_at?: string | Date | null | undefined;
};

const PRE_PAD_MS = 60 * 60 * 1000; // 60 min
const POST_PAD_MS = 60 * 60 * 1000; // 60 min
const DEFAULT_DURATION_MS = 4 * 60 * 60 * 1000; // 4h fallback

function toTime(v: string | Date | null | undefined): number | null {
  if (!v) return null;
  const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

export function getEventPhase(ev: PhaseInput, now: Date = new Date()): EventPhase {
  const start = toTime(ev.starts_at);
  if (start === null) return "pre";
  const rawEnd = toTime(ev.ends_at);
  const end = rawEnd ?? start + DEFAULT_DURATION_MS;
  const t = now.getTime();
  if (t < start - PRE_PAD_MS) return "pre";
  if (t > end + POST_PAD_MS) return "post";
  return "live";
}

/** Convenience: is the viewer inside the live window? */
export function isLivePhase(ev: PhaseInput, now: Date = new Date()): boolean {
  return getEventPhase(ev, now) === "live";
}

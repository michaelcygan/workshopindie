/**
 * Wave 8 — one presence policy.
 *
 * Presence has exactly two tiers, and every number that governs them lives
 * here so the client heartbeat and the server function can never drift apart.
 *
 *  1. Ephemeral tier — `public.user_presence`. Narrow, hot, expendable. One row
 *     per person holding last-seen time and their online-visibility flag. This
 *     is what "online now" reads. Rows are swept daily; losing the whole table
 *     costs nothing but a minute of green dots.
 *
 *  2. Durable tier — `profiles.last_active_at`. Unchanged in meaning (admin
 *     "last active", analytics, activity windows) but now written at most once
 *     per DURABLE_WRITE_INTERVAL_MS by `touch_presence()`, instead of once per
 *     minute per open tab against a table the whole app reads.
 */

/** How often a visible tab heartbeats. */
export const HEARTBEAT_INTERVAL_MS = 60_000;

/**
 * A person counts as online when their ephemeral row was touched inside this
 * window. Deliberately ~2x the heartbeat so one dropped beat doesn't blink
 * someone offline.
 */
export const ONLINE_WINDOW_MS = 2 * HEARTBEAT_INTERVAL_MS;

/**
 * The durable tier is a coarse timestamp, not a pulse. Enforced inside
 * `touch_presence()`, restated here so callers can reason about staleness.
 */
export const DURABLE_WRITE_INTERVAL_MS = 10 * 60_000;

/**
 * "Came back online" needs a real absence behind it, otherwise the per-minute
 * heartbeat would notify on every network blip.
 */
export const COME_ONLINE_THRESHOLD_MS = 10 * 60_000;

/** Ephemeral rows older than this are swept; they can't mean "online" anymore. */
export const PRESENCE_TTL_MS = 24 * 60 * 60_000;

/** Is this last-seen timestamp inside the online window? */
export function isOnline(lastSeenAt: string | Date | null | undefined, now = Date.now()): boolean {
  if (!lastSeenAt) return false;
  const t = lastSeenAt instanceof Date ? lastSeenAt.getTime() : new Date(lastSeenAt).getTime();
  if (!Number.isFinite(t) || t <= 0) return false;
  return now - t < ONLINE_WINDOW_MS;
}

/**
 * Did this heartbeat represent a return from absence? `prevSeenAt` is the
 * value from *before* the current beat was written.
 */
export function isComingOnline(
  prevSeenAt: string | Date | null | undefined,
  now = Date.now(),
): boolean {
  if (!prevSeenAt) return true;
  const t = prevSeenAt instanceof Date ? prevSeenAt.getTime() : new Date(prevSeenAt).getTime();
  if (!Number.isFinite(t) || t <= 0) return true;
  return now - t > COME_ONLINE_THRESHOLD_MS;
}

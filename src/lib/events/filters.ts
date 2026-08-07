/**
 * Client-safe event discovery invariants.
 *
 * Both the server discovery layer (`events/discovery.server.ts`) and
 * browser-side queries import these so no surface can drift: drafts and
 * canceled events never appear in discovery, and events whose owning group
 * is soft-deleted are always dropped.
 */
export const DISCOVERABLE_STATUSES = ["scheduled", "live", "completed"] as const;

export type DiscoverableStatus = (typeof DISCOVERABLE_STATUSES)[number];

/** The one canonical destination for an event anywhere in Workshop. */
export function canonicalEventPath(groupSlug: string, eventSlug: string): string {
  return `/g/${groupSlug}/e/${eventSlug}`;
}

/** Drop rows whose owning group is missing or soft-deleted. */
export function dropDeletedGroups<
  T extends { group?: { slug?: string | null; deleted_at?: string | null } | null },
>(rows: T[] | null | undefined): T[] {
  return (rows ?? []).filter((r) => r && r.group && !r.group.deleted_at && !!r.group.slug);
}

/**
 * Grace window for events with no end time. A flyer with only a start time
 * stays "happening now" for this long before it falls into the past.
 */
export const DEFAULT_EVENT_DURATION_MS = 3 * 60 * 60 * 1000;

/** When does this event stop being current? */
export function effectiveEndMs(e: { starts_at: string; ends_at?: string | null }): number {
  const end = e.ends_at ? Date.parse(e.ends_at) : NaN;
  if (Number.isFinite(end)) return end;
  return Date.parse(e.starts_at) + DEFAULT_EVENT_DURATION_MS;
}

/** Published, not archived, not canceled, not soft-deleted. */
export function isDiscoverable(e: {
  status?: string | null;
  published_at?: string | null;
  archived_at?: string | null;
  deleted_at?: string | null;
}): boolean {
  if (e.deleted_at) return false;
  if (e.archived_at) return false;
  if (!e.published_at) return false;
  return DISCOVERABLE_STATUSES.includes((e.status ?? "") as DiscoverableStatus);
}

/**
 * A recurring series contributes exactly one card: its nearest occurrence that
 * hasn't ended yet. Only when the whole series is over does the most recent
 * past occurrence stand in for it. Non-recurring events pass through
 * untouched, and each series keeps the list position of its first occurrence.
 */
export function collapseSeries<
  T extends { series_key?: string | null; starts_at?: string | null; ends_at?: string | null },
>(rows: T[], nowMs: number = Date.now()): T[] {
  const slotForKey = new Map<string, number>();
  const out: (T | null)[] = [];

  const endMs = (r: T) =>
    r.starts_at ? effectiveEndMs({ starts_at: r.starts_at, ends_at: r.ends_at }) : NaN;

  /** Is `candidate` a better representative of the series than `current`? */
  const isBetter = (candidate: T, current: T) => {
    const a = endMs(candidate);
    const b = endMs(current);
    if (!Number.isFinite(a)) return false;
    if (!Number.isFinite(b)) return true;
    const aFuture = a >= nowMs;
    const bFuture = b >= nowMs;
    if (aFuture !== bFuture) return aFuture; // upcoming always beats finished
    return aFuture ? a < b : a > b; // soonest upcoming, else most recent past
  };

  for (const r of rows) {
    const key = r.series_key;
    if (!key) {
      out.push(r);
      continue;
    }
    const slot = slotForKey.get(key);
    if (slot === undefined) {
      slotForKey.set(key, out.length);
      out.push(r);
      continue;
    }
    const current = out[slot] as T;
    if (isBetter(r, current)) out[slot] = r;
  }

  return out.filter((r): r is T => r !== null);
}

/**
 * Apply the discovery lifecycle invariants to any PostgREST query builder
 * (browser or server): published, not archived, not soft-deleted, and only
 * discoverable statuses. Keeps client-side rails from drifting from the
 * server discovery artery.
 */

export function applyDiscoverable<T>(q: T): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b = q as any;
  return b
    .in("status", DISCOVERABLE_STATUSES as never)
    .not("published_at", "is", null)
    .is("archived_at", null)
    .is("deleted_at", null) as T;
}

/**
 * "Still current" window: the event hasn't ended yet. Rows with no end time
 * get the default grace window.
 */
export function applyCurrentWindow<T>(q: T, nowMs = Date.now()): T {
  const nowIso = new Date(nowMs).toISOString();
  const graceIso = new Date(nowMs - DEFAULT_EVENT_DURATION_MS).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (q as any).or(`ends_at.gte.${nowIso},and(ends_at.is.null,starts_at.gte.${graceIso})`) as T;
}

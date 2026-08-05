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
 * A recurring series contributes exactly one card: the nearest occurrence in
 * the list's own sort order. Non-recurring events pass through untouched.
 */
export function collapseSeries<T extends { series_key?: string | null }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const key = r.series_key;
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(r);
  }
  return out;
}

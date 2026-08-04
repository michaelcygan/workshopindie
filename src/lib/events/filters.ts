/**
 * Client-safe event discovery invariants.
 *
 * Both the server discovery layer (`events/discovery.server.ts`) and
 * browser-side queries import these so no surface can drift: drafts and
 * canceled events never appear in discovery, and events whose owning group
 * is soft-deleted are always dropped.
 */
export const DISCOVERABLE_STATUSES = [
  "scheduled",
  "live",
  "completed",
] as const;

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

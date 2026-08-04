/**
 * Shared Supabase filters for Collab lifecycle reads.
 *
 * Nothing outside this file should filter Collabs on `status` directly —
 * lifecycle state is derived (see ./lifecycle.ts) and the legacy `status`
 * column is only kept for backwards compatibility.
 */

/** Legacy statuses that are never publicly visible. */
export const NON_PUBLIC_STATUSES = "(draft,removed,archived)";

const today = () => new Date().toISOString().slice(0, 10);

/* eslint-disable @typescript-eslint/no-explicit-any */
type Filterable = {
  is: (col: string, val: null) => any;
  eq: (col: string, val: any) => any;
  not: (col: string, op: string, val: any) => any;
  or: (filter: string) => any;
};

/**
 * Publicly visible Collabs: In Progress or Published.
 * Excludes archived rows and legacy private drafts.
 */
export function publicCollabs<T extends Filterable>(q: T): T {
  return q.is("archived_at", null).not("status", "in", NON_PUBLIC_STATUSES) as T;
}

/**
 * Collabs that are actually taking new collaborators right now:
 * public + In Progress + submissions open + deadline not passed.
 * This is the filter every discovery / board / promo surface should use.
 */
export function recruitingCollabs<T extends Filterable>(q: T, now = today()): T {
  return publicCollabs(q)
    .is("resulting_work_id", null)
    .eq("applications_open", true)
    .or(`ends_on.is.null,ends_on.gte.${now}`) as T;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

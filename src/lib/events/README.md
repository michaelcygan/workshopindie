# Events: the discovery artery

Every read of an event anywhere in Workshop goes through this folder. The point
is that no surface can quietly drift from the invariants below.

## Modules

- `filters.ts` — client-safe invariants (`DISCOVERABLE_STATUSES`,
  `dropDeletedGroups`, `canonicalEventPath`). Import this from browser code.
- `discovery.server.ts` — `listDiscoveryEvents()`, the server-side query
  builder. Import this from server functions, loaders and route handlers.

## Invariants

1. **One row = one dated occurrence.** A recurring event is a real
   `event_series` plus materialized `group_events` rows. `is_recurring` without
   a `series_key` is a data bug, not a feature.
2. **Pinning ranks, it never resurrects.** A pinned past occurrence still fails
   the date test on every surface.
3. **Drafts and canceled events are never discoverable.** Only
   `scheduled | live | completed` (`DISCOVERABLE_STATUSES`).
4. **Soft-deleted events and soft-deleted owning groups never appear.**
   PostgREST can't filter an embedded resource, so group deletion is dropped in
   JS via `dropDeletedGroups` / `sanitizeDiscoveryRows`.
5. **`group_only` requires a proven viewer check.** Service-role reads must
   restrict `group_only` rows to groups the viewer belongs to; public and
   fallback lanes see `public` only.
6. **Every event has exactly one canonical destination:**
   `/g/:groupSlug/e/:eventSlug`. External URLs are a "Official source /
   Tickets" button on that page, never a card's link target.
7. **In-person and hybrid events resolve a `venue_city_id`** at publish time,
   or they can never appear in city discovery.
8. **Every event has a primary `event_groups` row** (guaranteed by the
   `ensure_primary_event_group` trigger).

## Recurrence and cron

`event-series.server.ts` materializes a rolling horizon per series. It is
idempotent under the `(series_key, starts_at)` unique index, skips past cursors
without consuming the horizon count, and preserves local wall-clock time across
DST. `pg_cron` calls `/api/public/events/materialize` and
`/api/public/events/sweep`, both authenticated with the shared cron secret.

## Realtime

`useEventsRealtime(groupId)` opens one group-scoped channel on `group_events` +
`event_groups` and invalidates all event caches together. Don't add per-card
subscriptions.

## Tests

`bun run test` (`src/lib/events/event-series.test.ts`) covers DST steps, month
clamping, stale anchors and idempotency.

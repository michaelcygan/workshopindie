# Events artery: what's left

Most of the build has landed. I verified against the live database and the code:

- Data is clean: 9 events, 8 future, **0** with fake recurrence (`is_recurring` without a series), **0** in-person events missing a city, **0** events missing a primary `event_groups` row, and 1 real `event_series` row (the repaired TBD Tuesday open mic).
- All cron jobs exist and are active, including `event-series-materialize` and `events-sweep-5min`.
- The shared layer exists (`src/lib/events/discovery.server.ts`, `src/lib/events/filters.ts`) and is used by `/events`, the group events tab, group next-event, and the groups activity ticker.

Four gaps remain.

## 1. Surfaces still running their own event query (Wave 4)

These each hand-roll status/visibility/deleted filters, so they can drift from the invariants:

- `src/lib/home.server.ts` (two queries: member-home upcoming and the group-scoped list) — both include `group_only` without a membership check, and neither filters `status`, so a canceled event can appear.
- `src/components/home-pulse-rail.tsx` — client query, no group-deleted check.
- `src/lib/mention-suggestions.ts` — no status or visibility filter at all; drafts and canceled events are mentionable.
- `src/lib/mcp/tools/list-upcoming-events.ts` — no status/visibility filter.
- `src/components/event-peek.tsx` and `src/components/blog-entity-tag-picker.tsx` — same class of issue.

Fix: route each through `listDiscoveryEvents` where it is server-side, and through the shared `DISCOVERABLE_STATUSES` + `dropDeletedGroups` helpers where it must stay a browser query. Member-home `group_only` rows get an explicit membership check rather than an implicit one.

## 2. Canonical destination (Wave 5)

`src/components/event-card.tsx` still branches on `source === "external" && external_url` and can send the card off-site. The card should always link to `/g/:groupSlug/e/:eventSlug`; the external URL stays as the "Official source / Tickets" button on the event page (already present there).

## 3. Test runner wiring (Wave 7)

`vitest` is installed but `package.json` has no `test` script, so `src/lib/events/event-series.test.ts` can't be run by anyone but me ad hoc. Add `"test": "vitest run"` and confirm the suite passes.

## 4. Invariants doc + cache invalidation

- `src/lib/events/README.md` (Wave 0 deliverable) was never written — one short file recording the invariants so future work doesn't re-drift.
- Group-scoped realtime invalidation on `group_events` / `event_groups` so Today, the events tab, and member home refresh together instead of per-card subscriptions.

## Verification

`bun run lint`, `bun run build`, `bun run test`, plus a role pass (anon / non-member / member / admin) on `/events`, a group page, and member home.

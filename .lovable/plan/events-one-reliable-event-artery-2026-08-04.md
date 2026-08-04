# Events: one reliable event artery

## What I confirmed in the live app (not assumptions)

The "TBD Comedy Open Mic" row was resolved by ID, not by title:

- `id cf419709-ba24-440a-a8e9-3d7efd78b48f`, slug `tbd-comedy-open-mic`
- `starts_at 2026-07-22 01:00Z` / `ends_at 2026-07-22 04:59Z` — that is Tue Jul 21, 8:00 PM America/Chicago
- `status scheduled`, `visibility public`, `source external`, `external_url` = the organizer Instagram
- `is_recurring true`, `recurrence_label "Open mic every Tuesday"`, **`series_key NULL`**
- `pinned_at` set, **`venue_city_id NULL`**, venue "Monsignor Murphys", format `in_person`
- Host group: `chicago`, kind `city`, `city_id fe4d70ce-…`
- It already has 4 `event_groups` rows
- `event_series` table is **empty** (0 rows), and this is currently the **only** non-deleted event in the database

So the diagnosis in the brief is confirmed: this is a legacy *decorated singleton*, not a real series. It is past, so Today and `/events` correctly reject it, while the Group Events tab elevates it into "Pinned & recurring" with no date test. It also can never appear in `/events?city=Chicago` because `venue_city_id` is null.

Two further findings that change the plan:

- **All scheduled jobs are failing.** Every `pg_net` call in the last two days returned **403** (816/816). `events-sweep-5min` sends only an `apikey` header, but `/api/public/events/sweep` requires `x-cron-secret`. So status transitions, reminders and recaps have not run, and materialization is effectively dead too. This must be fixed in Wave 2, not assumed working.
- **There is no test runner.** `package.json` has no vitest and no `test` script; the one `*.test.ts` file in the repo cannot currently run. Wave 7 has to add the runner itself.

## Waves

### Wave 0 — Audit map and guardrails
Classify all 21 files querying `group_events` / `event_groups` / `event_series` into discovery, direct-page, admin, RSVP, notification, mention, maintenance. Record the invariants (one row = one dated occurrence; pin ranks but does not resurrect; recurrence requires a series; drafts/canceled never public; `group_only` requires a proven viewer check) in `src/lib/events/README.md`. Add an admin integrity report query set (no new tables).

### Wave 1 — Write-time integrity
- Persist `venue_city_id`, `venue_lat`, `venue_lng`, locality/region/country from `resolveVenueAndCity` through `admin.events.tsx`, `venue-autocomplete.tsx` and `admin-import-event-dialog.tsx` — today none of these write a city.
- Seed city from the host Group's `city_id` for in-person events, never overriding an explicit venue city.
- Block publishing an in-person/hybrid event with no resolved city; drafts stay permissive.
- Imports: force `source: "external"`, save `external_url` and organizer, never mark external as official, roll past recurrence anchors forward to the first future occurrence, and route approved recurrence through real series creation.
- Migration: idempotent trigger guaranteeing an `event_groups` row for every event's primary group (covers materializer inserts), plus backfill. Honor `extra_group_ids` for one-offs, new series and later occurrences.

### Wave 2 — Recurrence that actually runs
Rewrite `src/lib/event-series.server.ts` to: skip past cursors before counting the horizon, never decrement the needed count on a skip/conflict, stay idempotent under the `(series_key, starts_at)` unique index, preserve local wall-clock time across Chicago DST, and copy city/coords/source/organizer/external URL/visibility/cover/format plus group associations into each occurrence. DST handling uses `Intl`-based offset math (no new dependency) unless a helper proves insufficient.

Fix the scheduler: `/api/public/events/materialize` moves onto `requireCronSecret` (the publishable key is not a cron secret), and both cron jobs are re-registered to send `x-cron-secret`. Add an admin health signal for active series with zero future occurrences, overdue materialization, and errors.

### Wave 3 — One shared discovery layer
New `src/lib/events/discovery.server.ts` exposing `listEventOccurrences({ viewerId, groupId, cityId, when, format, featuredOnly, limit })` returning a stable DTO (ids, primary host group slug, canonical URL, phase `live`/`upcoming`/`past`, format, city, series key, recurrence caption, pin/feature state, source/organizer/external URL, group associations). Group scoping goes through `event_groups`; canonical links always use the primary host group's slug. Viewer authorization is explicit — the member-home service-role path that can leak `group_only` rows into city/worldwide fallbacks gets a real membership check.

### Wave 4 — Move every surface onto it
`GroupNextEvent` (currently a raw client query on `group_id` only), the Group Events tab sections (Happening now / Pinned & recurring / Upcoming / Past, one occurrence per series in the recurring band), `/events` + Featured Events, the Now board and "Around you", `/cities` counts, groups activity ticker, `@`-mention suggestions, blog event tagging, and MCP `list_upcoming_events`. Search params on `/events` stay compatible. Dead duplicate query code is removed only after confirming it is unused.

### Wave 5 — Canonical destination
`event-card.tsx` and `EventCardLite` always link to `/g/:groupSlug/e/:eventSlug`. The event page shows organizer and an "Official source / Tickets" button whenever `external_url` exists, opening in a new tab. Route unchanged.

### Wave 6 — Legacy repair, including TBD
Idempotent migration + admin review state for: missing primary `event_groups`, missing city on in-person/hybrid, `is_recurring` with no `series_key`, active series with no future occurrence, stale pinned recurring rows, drafts reachable by old queries. City is auto-inherited only when the primary host is the unambiguous official city Group.

For the confirmed TBD row: keep the Jul 21 occurrence as history with its slug, page, RSVPs and engagement intact; set its Chicago `venue_city_id` (resolved from the host Group, not hardcoded); create a weekly `America/Chicago` Tuesday 8:00 PM series carrying cover, venue, source URL, organizer, group associations and caption; attach the historical row to that series; materialize the future horizon; move pinning intent onto the next occurrence.

### Wave 7 — Tests
Add vitest + a `test` script (the repo has none today), then the 13 listed cases plus the frozen-clock Aug 4 2026 3:20 PM Chicago regression: the Aug 4 8:00 PM occurrence must show in Group Today, Group Events, `/events?city=Chicago`, Chicago's count and an eligible Now board; flip to "happening now" between start and end; then move to Past with next Tuesday promoted.

## Realtime and cache
Targeted invalidation on `group_events` and `event_groups` changes for Group Today, Group Events, member home, `/events`, city counts and featured queries — one group-scoped subscription, not one per card.

## Verification each wave
`bun run lint`, `bun run build`, new tests, migration idempotency, and role checks (anon / authed non-member / member / admin) on desktop and mobile.

## Sequencing note
Waves 0–2 land and are verified first (they are the actual root cause: no city, fake recurrence, dead cron). Waves 3–7 follow without leaving two parallel query systems in place.

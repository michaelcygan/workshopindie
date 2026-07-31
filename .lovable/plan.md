Wave 3 is done and verified. Moving to Wave 4.

# Wave 4 — Consolidate scheduled gatherings onto the canonical Events model

## Audit findings (verified this turn)

Data:

| Table | Rows |
| --- | --- |
| `standing_meetups` | **0** |
| `meetup_occurrences` | **0** |
| `event_series` | **0** |
| `group_events` | 1 (past) |

Code — `standing_meetups` is referenced in exactly **two** places, both read-only:
- `src/routes/index.tsx` → `CityMeetupsStrip` ("IRL / City meetups" strip), which returns `null` because the table is empty. It has been rendering nothing in production.
- `src/routes/cities.index.tsx` → `meetups:standing_meetups(count)`, which drives the "Most active" ranking, the live dot, and the "N meetups" label — all currently 0.

`meetup_occurrences` has **no application references at all**. There is **no create/update path** for standing meetups anywhere in the app: it is a read-only surface fed by a table nothing writes to.

Canonical infrastructure already exists and is the right destination:
- `group_events` carries `group_id`, `venue_city_id` (FK → `cities`), `status`, `visibility`, `starts_at`, `series_key`, `external_url`, capacity, and RSVPs.
- `event_series` plus the active `event-series-materialize` cron job (daily 03:15) materializes recurring instances. The `events-sweep-5min` and `events-report-sweep` jobs are also live.

So the two systems overlap only conceptually — the legacy one has no data and no writers. Wave 4 is a code consolidation, not a data migration.

## Changes

**1. Homepage — repoint the city strip at canonical Events**

`src/routes/index.tsx`: rename `CityMeetupsStrip` to `CityEventsStrip` and source it from `group_events` instead of `standing_meetups`. It shows upcoming public, non-deleted events that have a `venue_city_id`, ordered by soonest, limited to 8, and each pill links to the event page rather than a city group. It keeps the existing "IRL" eyebrow and pill styling, retitled "Happening in cities", and still renders `null` when empty — so the homepage looks identical today and lights up automatically once city events exist.

**2. New public server function**

`src/lib/group-events.functions.ts`: add `listCityEventsStrip` (public, uses the existing `publicClient()` helper and the same `deleted_at is null` + `visibility = public` guard as `listFeaturedEvents`) returning id, slug, title, starts_at, and the joined city name/slug. Adding it here keeps public event reads in one module with one visibility rule rather than issuing a raw browser query from the homepage.

Also add `listCityEventCounts` — upcoming public events grouped by `venue_city_id` — for the cities page.

**3. Cities page — count events, not meetups**

`src/routes/cities.index.tsx`:
- Drop `meetups:standing_meetups(count)` from the `cities` select.
- Fetch upcoming-event counts via `listCityEventCounts` and use that number for the "Most active" ranking weight, the live dot, and the row label, which becomes "N event/events".
- Update user-facing copy from "standing meetups" to "events" in the page kicker, the meta description, the OG description, and the JSON-LD description.

**4. Nothing else changes**

`/events`, event detail pages, RSVPs, the recurrence job, the featured carousel, and Group Events are untouched — they are already the canonical system and this wave only removes the second, empty one from the read paths.

## Database changes

None. No rows exist in `standing_meetups`, `meetup_occurrences`, or `event_series`, so there is nothing to migrate or archive — the legacy meetup records are empty by count, which satisfies the "migrated or explicitly archived" criterion. Dropping `standing_meetups` and `meetup_occurrences` (plus their policies and grants) is deferred to Wave 9, after this wave confirms no reads remain.

## Acceptance criteria

- Homepage and Events read from one canonical source (`group_events`); no homepage query touches `standing_meetups`.
- No app code references `standing_meetups` or `meetup_occurrences`.
- The recurrence job and existing event pages/RSVPs still work.
- No duplicate event instances render (one source, so structurally impossible).
- Cities page loads with event-based counts; ranking and copy stay coherent.
- `tsgo` typecheck clean.

## Verification

Typecheck, then a Playwright pass over `/` and `/cities` confirming both render with no console errors and no visual regression, plus a check that `/events` and the existing event detail page still load.

## Risks and rollback

Very low — both touched surfaces read empty data today, so behavior cannot regress for users. Rollback is a code revert; no migration to undo.

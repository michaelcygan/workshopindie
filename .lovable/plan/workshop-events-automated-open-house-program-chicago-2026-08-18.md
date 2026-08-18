# Workshop Events — automated Open House program (Chicago)

Workshop gets a control room for events it creates and maintains itself. The first program is **Workshop Open House — Chicago**: roughly four gatherings a month, one anchored at Off Color Brewing — Mousetrap and three rotating across the other eligible Chicago venues, kept about eight occurrences deep into the future and topped up automatically.

Everything it produces is an ordinary Workshop Event. There is no second event model, no separate public object, and no change to how existing recurring series or Co-working work.

## What exists today (verified)

- Dated events are `group_events` rows; `createEvent` handles city resolution, venue reconciliation, publish checks, group tagging, and member notifications.
- `event-series.server.ts` rolls a finite future horizon (8) for fixed weekly/biweekly/monthly series, is DST-aware, and is idempotent via a unique `(series_key, starts_at)` index.
- `/api/public/events/materialize` is cron-secured with `requireCronSecret()` and is already scheduled daily at 03:15 UTC. It calls `materializeAllDueSeries`.
- `workshop-venues.ts` holds the canonical registry; `evaluateVenuePolicy` / `reconcileVenue` enforce walk-in verification and group-policy triggers. Solemn Oath — Still Life has `walk_in_policy_verified: false`.
- Chicago group exists with slug `chicago`.
- `/admin/open-house` is the performer/presenter application queue and stays exactly as-is.

None of the above is rewritten. Open House is a *program* layered beside the fixed-calendar series engine, not folded into it.

## New admin surface

`/admin/workshop-events`, admin-only, added to the Manage section in `admin.tsx` as **Workshop Events**. **Open House** stays where it is.

**Program card — Workshop Open House — Chicago**
- Status (Active / Paused), cadence (4 per month), horizon (8), group, timezone, home base, venue pool
- Last materialized, last error, upcoming count, next date
- Health line: `Active — 8 future events scheduled`, or `Needs attention — 6 of 8 scheduled` with the specific venue/policy/materializer reason beneath
- Controls: Edit program · Pause / Resume automation · Top up now · View upcoming events
- Separate destructive action: Cancel future Open House events (same RSVP-notification path as `cancelEventSeriesFuture`)

Pausing only stops future generation; published events are untouched.

**Upcoming occurrences table** below the card: date/time, venue, neighborhood, RSVP count, capacity + overflow, status, venue-policy status, a "modified" marker when the row diverges from the program template, link to the event, cancel action. Occurrences needing venue review are visually flagged.

## Data model

One new table, `workshop_event_programs`, deliberately small:

`id`, `key` (unique, `open_house_chicago`), `program_type`, `group_id`, `active`, `timezone`, `events_per_month`, `target_future_occurrences`, `home_base_venue_key`, `venue_config` (jsonb: per-venue enabled / capacity / overflow / allowed windows / `needs_review` flag), `schedule_windows` (jsonb: explicit weekday + local start-time slots, e.g. weekday evenings 18:30/19:00, weekend afternoons 14:00/15:00), `duration_minutes`, `template` (jsonb event template), `created_by`, timestamps, `last_materialized_at`, `last_error`.

Two provenance columns on `group_events`: `workshop_event_program_id` (FK) and `program_occurrence_key` (unique, e.g. `open_house_chicago:2026-09:01`). The unique key — not title matching — is what makes reruns produce zero duplicates.

Grants and RLS: program table readable/writable by admins only via server functions; occurrence provenance columns are internal and not exposed publicly.

Seeding is idempotent: resolve the Chicago group by slug, insert the program only if `key` is absent.

## Scheduling: bounded, deterministic variety

Planning happens per calendar month, seeded by `program key + YYYY-MM`, using a small deterministic PRNG. No `Math.random()`. Re-planning September 2026 always yields the same September 2026 plan.

Per month:
- Slot 1: home base (Off Color), somewhat predictable
- Slots 2–4: rotate through the other enabled, eligible venues, cycling the pool before repeating
- Three evenings + one weekend afternoon by default, drawn from the configured discrete windows
- Distributed across the month (roughly weekly spacing, minimum gap enforced), avoiding repeated weekday/time pairs and identical month-over-month patterns
- Venue-specific day/window restrictions respected (e.g. Goose Island closed Mon–Tue)

Lead time: minimum 7 days. No backfilling. A mid-month activation creates only the sensible remaining occurrences and starts the strict four-per-month cadence the following month.

## Venue policy and capacity

The materializer calls the same `reconcileVenue` / `evaluateVenuePolicy` path as manual creation. It **never** sets `venue_policy_confirmed`.

- Venues whose policy would require review are skipped for unattended publication; the reason is recorded and surfaced in admin.
- Solemn Oath — Still Life stays in the pool, flagged **Needs review before auto-scheduling**, and is not autonomously published while unverified.
- Inactive or newly ineligible venues are skipped gracefully — one bad venue never fails the run.
- Capacity/overflow come from the program's per-venue config and stay below published group triggers: baseline 10/5; Half Acre 6/3; Begyle 8/4; Marz 6/3. These are Workshop event sizes, not venue capacities. A configuration that would trip review is reported, never silently shrunk or confirmed.

## Materializer

New server-only `src/lib/events/workshop-programs.server.ts`, following the safety principles of `event-series.server.ts`: timezone/DST-aware, finite horizon, idempotent on `program_occurrence_key`, per-venue error isolation, records `last_error`.

For each active program it plans forward month by month until ~8 future non-canceled occurrences exist, then inserts the missing ones directly (bypassing `createEvent`'s notification fan-out but reusing its venue reconciliation and publishability checks). Background top-ups are quiet — no "new event" notifications. Cancellations continue to notify RSVPs normally.

Generated event fields: title `Workshop Open House`, Chicago group, `format: in_person`, `source: workshop`, `is_official: true`, `visibility: public`, `rsvp_mode: open`, canonical `workshop_venue_key` plus name/address/lat/lng snapshot, `America/Chicago`, hostless facilitation, drop-in allowed, program capacity/overflow, `min_age` from venue/window where applicable. Existing event kind taxonomy is reused — no new kind is invented.

## Cron

`/api/public/events/materialize` is extended to run both sweeps and report them separately:

```text
{ ok: true, series: {...}, programs: { programs, inserted, skipped, errors } }
```

Same `requireCronSecret()`, same existing schedule. No second scheduler, no new exposed endpoint, no service-role operation reachable from the client.

## Stability guarantees

- An existing `program_occurrence_key` means that slot is done — later runs never recreate or reshuffle it.
- Manual edits to date, venue, copy, or capacity survive every subsequent run.
- An intentionally canceled occurrence is not replaced to force the count back to four.
- Program edits apply to newly materialized occurrences only. A separate explicit admin action can push safe template changes to existing future occurrences (same philosophy as `updateEventSeriesFuture`), never silently moving dates or venues with RSVPs.

## Elsewhere

`/admin/events` gains a subtle internal **Workshop auto** badge on rows carrying a `workshop_event_program_id`. No public rendering change. Open House applications are not auto-assigned to occurrences; lineup programming is out of scope.

## Files

- Migration: `workshop_event_programs` + two `group_events` columns + unique index + grants/RLS + idempotent Chicago program seed
- New: `src/lib/events/workshop-programs.ts` (shared types/labels), `src/lib/events/workshop-programs.server.ts` (planner + materializer), `src/lib/workshop-programs.functions.ts` (admin server fns), `src/routes/admin.workshop-events.tsx`, program card / occurrence table components
- Edited: `src/routes/admin.tsx` (nav), `src/routes/api/public/events.materialize.ts` (second sweep), `src/routes/admin.events.tsx` (badge)
- Untouched: `event-series.server.ts` engine semantics, Co-working flows, `/admin/open-house`, cron auth

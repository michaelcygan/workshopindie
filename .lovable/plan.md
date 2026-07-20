# Recurring events: rolling series, per-occurrence pages, cancel-to-stop

## Model

A recurring event is a **series with a rule**, not a fixed batch. Every occurrence stays its own `group_events` row with its own page, RSVPs, waitlist, lineup, companion thread, and photos. A background job continuously pre-materializes upcoming occurrences on a rolling horizon so future dates always exist as real, RSVPable pages. The series ends only when the admin cancels the recurrence (or an end date on the rule fires).

This preserves the per-occurrence RSVP semantics you already have and just fixes the "runs out after 26 rows" ceiling.

## Verified current state

- `createEventSeries` inserts a fixed `occurrence_count` (max 26) of rows sharing a `series_key`. Rule is not stored — after insertion, nothing knows the cadence.
- `updateEventSeriesFuture` / `cancelEventSeriesFuture` already scope by `series_key + starts_at >= anchor`. These stay as-is.
- RSVP is per `event_id` and works correctly.

## Schema (one migration)

New table `event_series`:
- `id uuid pk`
- `group_id uuid → groups(id)` (for RLS + auto-attach)
- `series_key text unique` (matches existing column on `group_events`)
- `recurrence_rule text` — `WEEKLY | BIWEEKLY | MONTHLY`
- `start_time_local time`, `duration_minutes int`, `timezone text` — cadence anchor
- `weekday smallint null` (0–6, for WEEKLY/BIWEEKLY) or `day_of_month smallint null` (for MONTHLY)
- `template jsonb` — snapshot of fields to copy into each new occurrence: `title, tagline, description, kind, format, venue_name, venue_address, venue_city_id, venue_lat, venue_lng, online_url, capacity, waitlist_enabled, visibility, cover_url, accent_color, lineup_capacity, is_official, timezone`
- `horizon_weeks int default 8` — how far ahead to keep materialized
- `next_run_at timestamptz` — next occurrence the sweeper should ensure exists
- `ends_on date null` — optional hard end
- `canceled_at timestamptz null` — set when admin stops the series
- `created_by uuid`, timestamps
- RLS: admins full access; group members read; grants per project rules.

No changes to `group_events` schema — `series_key` already exists and is the join key.

## Server functions and route

- `createEventSeries` (rewrite): validate rule + template, insert one `event_series` row, then materialize the first `horizon_weeks` of occurrences immediately (same insert path as today, just driven by the rule). Returns `{ series_key, materialized_count }`. Drops the `occurrence_count` input.
- `cancelEventSeriesFuture` (extend): also set `event_series.canceled_at = now()` so the sweeper stops. Existing per-occurrence cancel behavior unchanged.
- `updateEventSeriesFuture` (extend): also patch the matching keys on `event_series.template` so newly materialized rows inherit the edit.
- New public API route `src/routes/api/public/events.materialize.ts` (bearer-auth via `cron-auth.ts`, matching the existing `events.sweep.ts` pattern): for each non-canceled series where `next_run_at <= now() + horizon`, insert any missing occurrences up to the horizon (skip dates that already have a row for this `series_key`), then advance `next_run_at`. Idempotent.
- pg_cron entry: run the materializer daily (mirror the `events.sweep.ts` schedule).

## UI

- Admin event form: rename the recurring section from "Occurrences (N)" to "Repeat" with rule + weekday/day-of-month + optional "Ends on". No count field.
- `SeriesAdminStrip` on the event page: label becomes "Recurring · {WEEKLY|…}" and the "Cancel all future" action now stops the recurrence (per-occurrence cancels below the horizon still work exactly as today).
- Attendee-facing RSVP block: apply the per-occurrence date clarity from the previous plan — chip with the exact date, date baked into the button labels on recurring events, helper text "This RSVP is for {date} only. Other dates in this series need their own RSVP.", matching toast copy. This piece is what makes "each event page is only for that date" obvious.

## Not doing

- No dynamic/virtual occurrence pages. Every RSVPable date is a real row so waitlist, capacity, lineup, photos, and moderation all keep working unchanged.
- No cross-occurrence "RSVP all upcoming" one-tap. Explicitly out per your call.
- No changes to how recurring events appear on the group index / featured carousel.
- No RRULE/iCal-full spec — WEEKLY / BIWEEKLY / MONTHLY covers the current admin form and can grow later.

## Migration/backfill

For existing series in `group_events` that have `series_key` but no `event_series` row: create a row with best-guess rule (`WEEKLY`) from the median delta between existing occurrences, `next_run_at = last occurrence + delta`, `canceled_at = null`. Admin can adjust from the event page. Series with only one remaining occurrence are left alone (not backfilled) — they behave as one-offs until the admin explicitly re-enables recurrence.

## Order of implementation

1. Migration for `event_series` (+ grants, RLS, indexes on `series_key`, `next_run_at`).
2. Backfill script for existing series.
3. Rewrite `createEventSeries`, extend `updateEventSeriesFuture` / `cancelEventSeriesFuture`.
4. Materializer route + cron entry.
5. Admin form update.
6. RSVP block date clarity (from previous plan).

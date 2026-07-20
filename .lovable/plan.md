## Change: run the materializer daily, and always keep 8 occurrences ahead

You're right — 30 minutes is overkill for something that changes at most weekly. Two related tweaks:

### 1. Slow the cron down to daily
Reschedule the `event-series-materialize` pg_cron job from every 30 minutes to once a day (03:15 UTC — a quiet hour, off the top of the hour to avoid the cron rush). Unschedule the old entry and re-add it under the same job name.

### 2. Switch the horizon from "8 weeks" to "always 8 upcoming occurrences"
Right now the materializer tops up any occurrence whose start is within `horizon_weeks * 7` days from now. That means:
- Weekly series ≈ 8 future pages ready
- Biweekly ≈ 4 pages
- Monthly ≈ 2 pages

You want a consistent "always 8 instances ready" regardless of cadence. I'll change `materializeSeries` to be **count-based**: at each sweep, count how many future, non-canceled occurrences already exist for that `series_key` (starts_at >= now), and insert new ones from `next_occurrence_at` forward until the total reaches 8. `ends_on` and the unique `(series_key, starts_at)` index still bound and dedupe the loop.

The `event_series.horizon_weeks` column stays in the schema (harmless), but the materializer stops reading it. No data migration needed; the next daily sweep just refills each series to 8.

### Why this is safe
- Daily is plenty: a weekly series only "loses" one occurrence per week, so a once-a-day top-up always leaves at least 7 future pages visible at the worst moment (just before the sweep).
- The unique index on `(series_key, starts_at)` keeps the sweep idempotent — running it more often (e.g. right after an admin creates a series, which we already do) never duplicates rows.
- Cancel and edit flows are unchanged.

### Files touched
- `supabase/insert` (or SQL run) — `cron.unschedule('event-series-materialize')` then re-schedule at `15 3 * * *`.
- `src/lib/event-series.server.ts` — replace the week-based horizon in `materializeSeries` with a count-based "fill to 8 future occurrences" loop; keep the `advanceInstant`, cursor persistence, and `ends_on` guard.

No UI changes, no schema migration.
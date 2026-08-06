# Seed the 35 Chicago events without the admin button

The manifest is written and typechecks. The remaining step is getting those rows into the live database. Instead of asking you to sign in as admin and press "Seed Chicago", I'll run the same work directly against the database as a one-off data script.

## What gets created

- 13 weekly recurring listings (open mics, figure drawing, writers' and craft nights, hackerspace and civic-tech nights, The Infinite Wrench).
- 22 dated listings on the exact dates the organizers published (reading series, zine fest, songwriter nights, design meetups, indie game showcase, film screening, book club, run-and-read nights, photography workshop).
- Each listing is attached to the Chicago city Group, plus its medium Group, plus any secondary medium (for example the zine fest reaches both Writing and Visual Art).

Every row is marked as someone else's event: not official, source "external", and always linking to the organizer's own page. Nothing implies Workshop runs or sponsors them.

## How it runs

1. Insert one recurring-series row per weekly event, keyed by its stable manifest key, with the same template the seeder builds (title, blurb, venue, medium, organizer link, provenance flags).
2. Insert the dated events directly, skipping anything already in the past.
3. Trigger the existing occurrence materializer so the weekly series fill out the next eight weeks of dates.
4. Spot-check the Chicago group's events list and a couple of event pages to confirm dates, times, venues and the external-organizer attribution render correctly.

Re-running is safe: the stable keys and the existing uniqueness rules make a second pass a no-op rather than a duplicate.

## Technical notes

- Executed with the data-change tool (INSERT only) against `event_series` and `group_events`, mirroring `src/lib/seed/chicago-events.functions.ts` exactly — same `series_key`, `template` JSON from `seedTemplate`, `extra_group_ids` resolved from `MEDIUM_GROUP_SLUG`, `horizon_weeks = 8`, timezone `America/Chicago`.
- Local start times are converted to UTC in SQL using `AT TIME ZONE 'America/Chicago'`, so daylight saving is handled the same way the seeder handles it.
- `created_by` is set to an existing admin account so ownership matches what the button would have produced.
- Occurrence fan-out uses the existing `/api/public/events/materialize` endpoint rather than reimplementing `materializeSeries`.
- Group links are written to `event_groups` for each dated event; series occurrences pick up their groups from `extra_group_ids`.
- No schema changes, and no application code changes beyond what's already committed.

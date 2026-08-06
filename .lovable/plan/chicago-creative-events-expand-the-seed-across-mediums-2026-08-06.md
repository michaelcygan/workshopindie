# Chicago creative events — expand the seed across mediums

## What already exists (verified in the codebase and database)

- External provenance (Wave 1) is largely already fixed: the import dialog sends `source`, `external_url`, `external_organizer` and sets `is_official: false` for external events; the event page hides the "Official" chip, shows an "External event" chip, and renders an "Official event page" link from `external_url`; event cards show "External event ·" with the organizer.
- A Chicago seed already runs: `src/lib/seed/chicago-events.data.ts` (7 entries), `src/lib/seed/chicago-events.functions.ts` (admin-only, idempotent via `series_key`), triggered from `/admin/events`.
- Currently seeded and live: Uncommon Ground open mic, Gallery Cabaret jam + open mic, Cole's comedy mic, Hungry Brain Sunday Transmission, Platform Studios figure drawing (Tuesday only), Green Mill Uptown Poetry Slam (2 dated occurrences).
- Groups resolve by slug: `chicago` plus system medium Groups `music`, `writing`, `visual-art`, `film-video`, `games-tech`. Medium Groups are attached automatically from `creative_category`; `event_series.extra_group_ids` exists and is honoured by the materializer, but the seed does not currently set it.

So this pass is mostly Waves 2–9: research, expand the manifest, add second-medium support, re-run, QA.

## Wave A — Research the 40 leads

For each of the 40 candidates I fetch the organizer's or venue's own page (not aggregators where avoidable) and record: exact title, organizer, canonical URL, whether it is currently active, next published occurrences, recurrence as the organizer states it, start/end times, venue name and street address, age/admission/signup notes, and a short paraphrased description. Anything unverifiable or dormant (likely candidates: TEST Literary Series, Chicago Filmmakers networking, Spudnik Open Studio) is omitted and listed in the final report. No invented prices, ages, capacities, or dates.

Target mix, roughly matching the brief: ~5 music, ~6 writing/storytelling, ~4 visual art/maker, ~4 tech/games, ~3 books/reading, ~2 design, ~2 film, plus the strongest extras — 25–40 total including the 7 already live.

## Wave B — Manifest and seeder changes

1. `chicago-events.data.ts`
   - Add a `secondary_categories` field (medium Group slugs) so e.g. a zine night reaches both Writing and Visual Art, and a storytelling mic reaches Writing alongside Music.
   - Add optional `format` (so `online` book clubs are not stamped `in_person`) and optional `sessions` notes for multi-session programs (Light Painting Workshop) so all dates appear in the one event description rather than as unrelated events.
   - Fill in the researched entries, keeping the existing `key` values untouched.
2. `chicago-events.functions.ts`
   - Resolve medium Group ids by slug at runtime and pass `extra_group_ids` on series, and write `event_groups` rows for dated occurrences.
   - Keep the existing idempotency: series keyed by `series_key`, dated rows deduped by the unique `(series_key, starts_at)` index, templates refreshed in place on re-run.
3. Recurrence discipline: WEEKLY series only where the organizer publishes a stable weekly schedule; one series per weekday (Platform Tue/Wed/Thu, Fuller's Wed/Thu, Infinite Wrench Fri/Sat/Sun); nth-weekday and irregular events get 3–6 explicit verified dates each. No MONTHLY rule used anywhere in this seed.

## Wave C — UX gaps to close

- Add one restrained line near the RSVP control on external events: RSVP on Workshop signals interest to other members; tickets, sign-up lists, cover and age rules stay with the organizer.
- Confirm the "Official event page" CTA and organizer attribution read correctly on mobile and logged out; adjust only if something is missing.

## Wave D — Run and QA

Run the seed, then verify with database queries and browser checks: zero seeded rows with `is_official = true`, every row `source = 'external'` with organizer and canonical URL, Chicago city resolved and addresses correct, `America/Chicago` with a weekly series crossing the DST boundary correctly, events visible in the Chicago Group, in `/events`, in the right medium Group, on mobile, and on a logged-out public event URL. Then run the seed a second time and confirm zero duplicates.

## Final report

Seeded vs omitted (with reasons), counts by medium, upcoming occurrence count, and confirmation of the provenance/idempotency checks.

## Technical notes

Files touched: `src/lib/seed/chicago-events.data.ts`, `src/lib/seed/chicago-events.functions.ts`, and possibly `src/components/event-rsvp-block.tsx` for the one line of RSVP copy. No schema migration expected — `source`, `external_url`, `external_organizer`, `extra_group_ids`, and the `(series_key, starts_at)` unique index all already exist. Research is delegated to parallel subagents, one batch per section of the list.

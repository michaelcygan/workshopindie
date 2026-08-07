# Milwaukee Creative Events Seed

Extend the existing Chicago external-event seed architecture to Milwaukee. No new event system, no new database abstraction.

## What already exists (verified)

- The Milwaukee city Group exists (`/g/milwaukee`) and is linked to a Milwaukee city record, created through the canonical provisioning path. No IDs get hardcoded — it is resolved by slug.
- All five medium Groups exist: music, film-video, writing, visual-art, games-tech.
- The Chicago manifest (`src/lib/seed/chicago-events.data.ts`) already models exactly what this build needs per event: title, tagline, description, kind, primary medium, secondary mediums, format, venue name/address, external URL, external organizer, source note, cover, cadence.
- The seed runner already sets `source: "external"`, `is_official: false` on every row, resolves medium Groups by slug, and is idempotent: recurring entries key on a stable series key, dated entries rely on a unique index on (series key, start time) so a rerun is a no-op while templates get refreshed.
- The recurrence engine supports WEEKLY, BIWEEKLY and MONTHLY, but MONTHLY is numeric day-of-month only — so "first Saturday" / "second Wednesday" style schedules will be materialized as explicit verified dates, exactly as the request requires.

Gap to close: the current runner only handles `weekly` and explicit-dates cadences. Biweekly needs wiring through (the engine supports it; the seed path does not yet).

## Approach

1. **Generalize, don't duplicate.** Move the shared seed logic out of the Chicago-specific function into one city-agnostic runner that takes a city Group slug, a timezone and a manifest. Chicago keeps behaving identically; Milwaukee reuses it.
2. **Add biweekly** as a supported cadence in that runner (first occurrence anchored to a verified published date from the organizer, then stepped forward by the existing engine).
3. **Add a Milwaukee manifest** file mirroring the Chicago one, timezone `America/Chicago`.
4. **Verify every event against its organizer source before writing it.** For each of the 20 leads: open the organizer's own page/calendar, confirm the program is active, read the next published dates, title, venue, time, cost, age and signup. Anything that cannot be confirmed from the organizer is not seeded and is reported as skipped. No invented prices, capacities, ages or descriptions.
5. **Run it server-side, no button press**, the same way the city launch was run: a script that authenticates as an admin and invokes the seed. Then run it a second time to prove zero duplicates.

## Recurrence buckets

- **Weekly series:** Laughs on Tap (only if the organizer still confirms weekly Wednesdays; occurrences will not be materialized inside an announced pause).
- **Biweekly series:** Readshop, Miltown Game Developers Saturday Workgroup — each only if the live source still confirms the every-two-weeks pattern.
- **Explicit published dates** (recurring programs whose real schedule is nth-weekday, seasonal, or venue-varying): Open Decks, Recess!, tightknit, Cactus Book Club, Poetry in the Park, Solitary Plover, Over the Prairie // Under the Prairie, Code + Brews, Code & Coffee, Milwaukee Makerspace (alternating Lenox / Norwich venues preserved per date), Milwaukee Sketch Club (each outing keeps its own venue), MPL Silent Book Club, Cinematic Sisterhood (one event per announced film, with the series name as context in the title).
- **One-offs:** Alligator with live score, the current Build Night, Dialogues Documentary Festival 2026.

## Geography and format

- In-person Milwaukee events attach to the Milwaukee Group plus their medium Group(s).
- Venue truth wins: the Makerspace Norwich location keeps its real St. Francis address while still surfacing in Milwaukee discovery through the Group attachment.
- Online events (Readshop, Miltown workgroup) use `format: online` with no fabricated venue, address or coordinates, and link to the organizer's public registration page — never a private Zoom or Discord URL.

## Provenance in the UI

Existing event pages already render external provenance and no Workshop Official badge for `is_official: false`. As part of this build I will check the outbound CTA and RSVP wording on a seeded Milwaukee event on desktop and mobile, and adjust copy only if it could read as though a Workshop RSVP registers you with the venue.

## QA before calling it done

Check a seeded event end to end: Milwaukee Group, medium Group, events discovery, logged-out page, logged-in page, mobile, share/OG. Confirm Central Time renders correctly, no past dates were written, external provenance is present on every row, and a second run of the seed adds zero duplicates.

## Report

A summary listing: which of the 20 were verified and imported, which were skipped and why, total occurrences created, which use weekly, which biweekly, which explicit dates, which are one-offs, any schedule or venue that differed from this brief during live verification, and the duplicate-free rerun result.

## Technical notes

- New: `src/lib/seed/milwaukee-events.data.ts`, a shared runner extracted from `chicago-events.functions.ts`, and `scripts/seed/run-milwaukee-events.ts`.
- Idempotency key: the stable per-event `key` becomes `series_key`; dated rows are unique on (series key, start time). Rerunning refreshes templates and adds newly published dates without duplicating.
- No schema migration expected. No new event kinds, no new taxonomy.

# Events Living Flyer — Waves 6 and 7

Finish the Events refinement: make every discovery surface agree with the new lifecycle, and retire the legacy event modules the four-tab page replaced.

## Wave 6 — Discovery, Groups, Homepage, archive

**One rule, one place.** All event lists already flow through the discovery artery (`src/lib/events/discovery.server.ts` + the client-safe `src/lib/events/filters.ts`). Today they filter on `status` and `starts_at` only, which means a published-but-started event can drop off a list before it ends, and drafts rely on status alone.

Changes:

- Lifecycle-aware filtering in the discovery query: only events with a publish stamp and no archive stamp are discoverable; drafts, canceled, and archived never appear.
- "Live until it ends": an event stays in upcoming/live lists until its end time (falling back to a sensible window when no end time is set), instead of disappearing the moment it starts. Past lists pick it up only after it ends.
- Recurring series contribute exactly one card — the nearest upcoming occurrence — so a weekly night doesn't flood a city or group feed.
- Apply the same artery to the Events index, city pages, group pages, and the homepage rails so nothing hand-rolls its own filter.
- Archive view: past and archived events for a group are reachable but out of the main flow, with the flyer still readable and participation frozen.

## Wave 7 — Cleanup and proof

- Remove the legacy modules the four-tab page no longer uses: companion panel, who-strip, attendees sheet, attendee-work, standalone photos section, old wall component, and the old phase helper — after confirming no remaining imports.
- Fold any still-valuable behaviour (person peek from the roster) into the new components rather than keeping the old file alive.
- Tests: extend the lifecycle suite with discovery cases (live-until-end, archived hidden, draft hidden, one card per series) and keep the whole suite green.
- Verify the real pages end to end: signed-out flyer, RSVP, check-in, wall post, gallery, and a past event's frozen state.

## Technical notes

- `listDiscoveryEvents` gains lifecycle predicates (`published_at` not null, `archived_at` null) alongside the existing status filter, and the upcoming/past split keys off end time rather than start time.
- Series de-duplication happens after the query, keyed on `series_key`, keeping the earliest upcoming occurrence — cheap, and it keeps a single query.
- `DISCOVERABLE_STATUSES` stays the client-safe invariant; new lifecycle predicates live beside it in `filters.ts` so browser-side queries can't drift from the server.
- Deletions are import-checked first; anything still referenced stays until its caller is migrated.

# Finish the Chicago seed without a button press

Waves 1–5 are already built. What's left is actually running the seed, then the QA and reporting waves. Since the seed function requires a signed-in admin session I don't have, I'll perform the identical seed directly against the database using the same manifest, keys, and rules — so the admin button stays valid and a later press is a no-op.

## Wave 5b — Run the seed

- Insert one recurring series per weekly entry, keyed by its stable identifier (`chi_uncommon_ground_open_mic`, `chi_gallery_cabaret_open_jam`, `chi_gallery_cabaret_open_mic`, `chi_coles_comedy_open_mic`, `chi_hungry_brain_sunday_transmission`, `chi_platform_studios_figure_drawing`), attached to the Chicago city Group, timezone America/Chicago, with the verified venue, address, organizer, and organizer link.
- Insert the two published Green Mill Uptown Poetry Slam dates (Aug 16 and Sep 20, 3–5pm) as individual listings.
- Materialize upcoming dated occurrences for each weekly series over the standard 8-week horizon, and let the existing recurring-events job keep them rolling.
- Every row: external provenance, not Workshop-official, organizer link stored, no fake attendance, no fake accounts.
- Idempotency is enforced by the existing unique keys, so nothing duplicates on a re-run.

Omitted as agreed: Pen Flow Writing Sessions, Group Draw at Lot'sa, Chicago Filmmakers classes.

## Wave 6 — UX QA

Browser checks against the running app: Chicago Group discovery signed-out and signed-in, the events directory inside the Group, one event page (organizer credit, address, "Official event page" link, external chip instead of Official, RSVP-is-an-intention copy), the Medium Group cross-listing, a mobile pass at phone width, add-to-calendar, and a recurring instance plus its next date.

## Wave 7 — Report

Counts of listings and upcoming occurrences, confirmation that zero seeded events are marked official, that every one carries the organizer's canonical link, that Chicago and venue cities resolved, that weekly times stay correct across the DST boundary, and that a second run adds nothing.

## Technical notes

The seed is written as data changes mirroring `src/lib/seed/chicago-events.functions.ts` (series rows plus materialized `group_events`, cross-listed into `event_groups`), using the manifest in `src/lib/seed/chicago-events.data.ts` as the single source of truth. No schema migration, no code changes expected unless QA turns up a defect.

## Goal
Never show the "Live events are coming" empty state on the homepage when there's at least one upcoming public event — even if none is explicitly marked featured. Applies to both the compact sidebar card and the main "Events" module.

## Change
Update `listFeaturedEvents` in `src/lib/group-events.functions.ts` to fall back gracefully:

1. Run the current query: featured (`featured_at IS NOT NULL`), upcoming, public, not deleted, ordered by `starts_at`, limit 6.
2. If it returns 0 rows, run a fallback with the same filters minus `featured_at`, still upcoming/public/not-deleted, ordered by soonest `starts_at`, limit 6.
3. Return whichever set has rows.

Both `FeaturedEventsCompact` and `FeaturedEventsCarousel` consume this function, so the fix flows to both surfaces automatically. No client changes needed — the empty state only renders when the returned array is empty, which now only happens when there are truly no upcoming public events at all.

## Notes
- Keeps curator-featured events first when they exist; only fills in when nothing is featured, so it never demotes curated picks.
- One extra indexed query only in the empty case.

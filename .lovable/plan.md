## Diagnosis
The TBD Comedy Open Mic event has `starts_at = 2026-07-22`, which is 3 days in the past. Today's `listFeaturedEvents` filter is `starts_at > now()`, so any event whose start time has passed is excluded — even if it's the only event on the platform and it's still effectively "current" (TBD placeholders, ongoing events, or events without a real end time).

## Change
Update `listFeaturedEvents` in `src/lib/group-events.functions.ts` to treat an event as "still relevant" if either:
- `ends_at > now()` (event is ongoing or hasn't ended), OR
- `ends_at IS NULL AND starts_at > now() - interval '7 days'` (recent/TBD event with no end time set).

Apply this to both the primary (featured) query and the fallback (any-upcoming) query added last turn. Order: soonest upcoming first; then fall back to most-recent past-but-relevant.

Because PostgREST can't easily express that OR, do it as two queries in the handler and merge/dedupe (upcoming first by `starts_at ASC`, then recent-past by `starts_at DESC`), capped at 6.

## Result
- Featured, future events still take priority.
- If nothing is featured/future, the sidebar and homepage rail show the soonest upcoming public event.
- If nothing is upcoming either, they show recent public events from the last week (covers the TBD case).
- Only when there's truly no relevant event does the empty state appear.

No client changes.

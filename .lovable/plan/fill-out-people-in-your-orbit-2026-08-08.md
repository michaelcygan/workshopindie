# Fill out "People in your orbit"

Today the module only shows people you *don't* already follow who share one of your Groups. Anyone you already follow is filtered out, so the surface can end up with a single card even when your orbit is bigger.

## What changes

- Keep the existing suggestion logic first (shared medium / your city / shared Group) — those stay at the top.
- When that produces fewer than the target number of cards (6), pad the rail with the people you followed most recently, newest first, until the module is full or there's no one left.
- Followed people get their own label so the card still explains itself: "You follow them", or their shared medium when there is one (e.g. "Shares your photography work").
- No duplicates: someone already surfaced by the algorithm isn't repeated in the fallback.
- Blocked users, non-discoverable profiles, profiles without a username, and yourself stay excluded from the fallback too.
- Also run the fallback when the viewer belongs to no Groups (today the function returns nothing at all in that case), so a new member who follows a couple of people still sees the module.

## Technical notes

- All changes in `peopleSuggestionsServer` in `src/lib/home.server.ts`; the `HomePersonSuggestion` shape and the rendering in `src/components/home/member-home.tsx` are unchanged.
- Drop the early `if (!groups.length) return []` guard; the shared-group portion becomes conditional instead.
- Fallback query: `follows` filtered by `follower_user_id`, ordered by `created_at` descending, limited to the remaining slots (with headroom for filtered-out rows), then joined to `profiles` with the same `discoverable = true` and username filters used above.

## Goal

Polish the Collab Board (`/collab`) to match the level of Groups and Workshops, and drop the "Shipped" filter entirely so the board is purely about *open* opportunities.

## Changes — `src/routes/collab.index.tsx`

1. **Drop the `view` filter entirely.**
   - Remove `view` from `searchSchema` and the `SearchShape` type.
   - Remove `setView`, `filters.view`, and the entire All / Open / Shipped pill row.
   - In `fetchPosts`, hard-code the query to the previous `view === "open"` branch (status open + not expired). No more shipped/closed handling on this surface — shipped works belong on the resulting Work pages.
   - Update the empty-state copy to drop the "shipped" implication.

2. **Tighten the header band.**
   - Merge the kicker chip + tagline + recap chip into a single tidy meta row directly under the title (current spacing is two-row).
   - Replace `RecapChip count={rawPosts?.length} label="open"` with a single subtle "N open" pill so it matches the chip-style header used on Groups/Workshops.

3. **Filter cluster polish.**
   - Remove the empty `<div>` spacers (lines 399–401) left over from the dropped row.
   - Keep the category scroller + city combobox + Online toggle on one wrap line; ensure they collapse cleanly on mobile (already mostly there).

4. **Section ordering & copy.**
   - Keep "Live right now" (when present) → "Boosted by the community" → "Open Collabs".
   - Rename the unlabeled grid header when there are no boosted/live items to a simple "Open Collabs" with a hairline divider so the page never starts grid-less.

5. **Light a11y & perf nits.**
   - Add `aria-label` to the Online toggle.
   - Type the `cities` `useQuery` return so the inline `(c: {...})` cast is gone.
   - Use a stable `staleTime: 30_000` on the main `useQuery` to match the boosted query and reduce refetch churn.

No DB or server changes. No new components.

Update `src/components/lounge-posts.tsx` so the Posts tab always shows a filter chip rail whenever there is at least one author with posts (currently it only shows when there are 2+).

Changes:
- Render the chip rail when `authorsWithPosts.length >= 1` (drop the `> 1` gate).
- Rename the leading chip from "Everyone" to "All".
- Dynamically render one small name chip per participant who has published posts (avatar + first name / display name, truncated), which is already the data source — just no longer hidden behind the 2+ check.
- Clicking a name filters posts to that author; clicking the active chip or "All" clears the filter. No changes to data fetching, peek behavior, or empty states.

No backend or business-logic changes.
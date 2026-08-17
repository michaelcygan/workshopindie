Remove the legacy "Live audio only" signal from the Collabs page.

Scope:
- Collabs page (`src/routes/collab.index.tsx`) is the only surface to touch.
- No changes to the standalone Collab creation flow, card component, or database schema.

What to do:
1. Drop the `live` field from the Collab search schema.
2. Remove the "Live audio only" toggle from the "Signals" section inside the More Filters popover.
3. Remove the live-filter check in the client-side refinement logic.
4. Remove the "Live right now" horizontal strip and the "live now" badge in the compact masthead.
5. Remove the `live` reset from the clear-filters action.
6. Remove the now-unused `Radio` import from the file.

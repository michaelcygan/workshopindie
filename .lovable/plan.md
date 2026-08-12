# Fix the Collabs category filter overflow

## What's wrong

On the Collab Board, the category rail (All, Music & Audio, … Making, Craft & Engineering) spills past the right edge of the toolbar and runs off the page instead of scrolling inside its own pill.

Cause (confirmed in code): the rail is wrapped in a fixed-width container (`shrink-0`) in `src/routes/collab.index.tsx`, so it can never shrink to the available width. The same component on Gallery is given a shrinkable slot, which is why Gallery renders correctly.

## The fix

- In `src/routes/collab.index.tsx`, change the filter cluster so the category rail sits in a shrinkable, full-width slot (`min-w-0 flex-1`, with the city/online controls on their own row at desktop widths) instead of `shrink-0`.
- Give the rail its own line above the city + "Online only" row so long field names have room, matching the Gallery toolbar rhythm.
- Keep mobile behavior unchanged (the rail already collapses to a single dropdown pill).

No changes to filtering logic, query params, or data — this is layout only.

## Verification

- Desktop: rail stays inside the toolbar, scrolls horizontally, overflow menu still lists every field; no chips escape the container at 1024–1440px.
- Mobile: dropdown pill unchanged.

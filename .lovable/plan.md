# Gallery pass — desktop + mobile

The circled problem: the 13 field chips ("All, Music & Audio, Film & Video, … General") wrap into a four-row block inside the sticky toolbar. On desktop that block pushes every other control (sort, tabs, city, search) into an awkward island and eats ~180px above the grid. Mobile is fine (chips collapse to a dropdown) but the second control row is cramped.

## What changes

### 1. Consolidate the filter bar into one row
- Replace the wrapping chip cloud with a **single-line, horizontally scrollable** chip rail that never wraps, with soft fade edges. Priority fields stay visible; the rest scroll.
- Add an "All fields" dropdown at the end of the rail so any of the 13 fields (and later subcategories) is reachable in one click without the rail growing.
- Collapse **Sort** (Recent/Trending) and **City** into the same row as compact controls; keep For you / Following / Favorites as the leftmost segmented control since it's the primary lens.
- Search stays an icon toggle; the expanded field overlays the row instead of adding height.
- Result: toolbar is one 44px row on desktop, two compact rows on mobile.

### 2. Tighten the top of the page
- Merge the "Gallery" masthead and the "Your groups" strip into one band: title + subtitle on the left, Post to Gallery on the right, group chips on a slim second line. Removes one full border/padding band.
- Group chips get avatars on desktop and stay scroll-snapped on mobile.

### 3. Featuring before the grid (borrowed from Blog + Home)
Add a compact editorial block between the toolbar and the grid, only on the default view (For you, no filters/search active) so it never fights an active query:
- **Spotlight** — one large 16:10 hero work (highest recent popularity) with title, creator, field chip; on desktop it sits beside a stacked 2-up of runners-up, same proportions as the home featured-blog carousel.
- **Recent** — the existing "last 24h" rail (currently below the grid) moves up under the spotlight where it's actually useful, in the same slim ticker style used on Home.
- On mobile the spotlight becomes a single swipeable carousel card, matching the mobile blog masthead.

### 4. Grid polish
- Keep 16:10 cards; go to 2 / 3 / 4 columns at sm / lg / xl as today but tighten gaps and align the section padding with the new header so the page reads as one column of content.
- Loading skeletons match the new spotlight + grid shape instead of only the grid.

## Technical notes
- `src/routes/gallery.tsx`: restructure the masthead/toolbar JSX, gate the featured block on `tab === "for-you" && !filtersActive`, move `<FreshWorksStrip />` above the grid.
- `src/components/category-scroller.tsx`: desktop variant becomes a no-wrap scroll rail with an overflow dropdown; mobile dropdown behavior unchanged.
- New `src/components/gallery/gallery-spotlight.tsx`: reuses the existing works query shape (popularity_score ordering, published/public) and `WorkCard` primitives — no new tables, no schema change.
- `YourGroupsStrip` gains a `variant="inline"` so it can render inside the masthead band without its own border; other pages using it (collabs, events) keep the current look.

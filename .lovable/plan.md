## Goal
Bring the Gallery in line with the 2027 editorial polish already applied to Profile and Home: same 16:10 tiles, a tighter above-the-fold header so real work appears immediately, and one clean toolbar row instead of the current stacked title → kicker → strip → strip → filters → filters → banner stack that pushes the grid halfway down the page.

## Content-first restructure (`src/routes/gallery.tsx`)

Above-the-fold today: PageHeader block → Recent kicker line → `FreshWorksStrip` → `YourGroupsStrip` → 3-row sticky toolbar (search + tab pill + sort pill / category chips + city + clear / geo banner) → grid.

New above-the-fold (in order):

1. **Slim editorial masthead** — one row, ~72–88px tall.
   - Left: "Gallery" wordmark + one-line subtitle ("Everything people made across Workshop.") merged inline; kicker chip removed.
   - Right: "Post to Gallery" button (unchanged).
2. **`YourGroupsStrip`** kept, but only rendered when the user actually has group chips to show (existing component already no-ops when empty; verify) and pulled up under the masthead so it acts as a personal nav rail.
3. **Single sticky toolbar row** — collapses the three current rows into one horizontally-scrollable line on mobile / one flex row on desktop:
   - Compact search icon-button that expands to an input on click/focus (search field no longer takes 100% width by default).
   - Category chips (inline, scrollable).
   - Sort chip pair (Recent / Trending).
   - Overflow menu ("…") on mobile that contains: For you / Following / Favorites tabs, City filter, Clear filters. On desktop these stay inline to the right.
4. **`GeoDefaultBanner`** demoted to a small inline pill inside the toolbar row (only when actionable), not its own full-width block.
5. **`FreshWorksStrip`** moved to render *below* the main grid as a "Just posted" rail — the main grid is the point of the page and should lead. (Fresh works are still surfaced there and via the "Recent" sort.)

Net effect: real work tiles appear within the first ~180px on desktop and ~220px on mobile instead of ~600–700px.

## 16:10 thumbnails

- Pass a new `aspect="16/10"` prop to `WorkCard` from the Gallery grid, or gate on `density`. Simplest: extend `WorkCard` with an optional `aspect?: "auto" | "16/10"` prop that, when set, overrides `aspectClassFor(work.cover_aspect)` with `aspect-[16/10]` (mirrors what `density="hero"` already does but without inflating title/padding). Gallery passes `aspect="16/10"`.
- Update loading skeletons in `gallery.tsx` from `aspect-[4/5]` → `aspect-[16/10]`.
- Reduce grid column counts one step to keep tiles readable at the wider ratio: `grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` (was up to 5). Row density stays high because 16:10 is shorter than 4:5.

## Small polish
- Remove the redundant `Recent`/`Trending` kicker in the header — the sort pill in the toolbar already communicates state.
- Ensure sticky toolbar keeps `top-0 md:top-14` behavior and remains under the mobile brand header.
- Keep all query/data logic, tabs, filters, and search params exactly as-is — this is a UI composition + tile-ratio change only.

## Technical notes
- Files touched: `src/routes/gallery.tsx` (layout/order + skeleton ratio + grid columns), `src/components/work-card.tsx` (new optional `aspect` prop, non-breaking default).
- No schema, query, or search-param changes.
- No changes to `FreshWorksStrip`, `YourGroupsStrip`, `GeoDefaultBanner` internals — only where/when they render.

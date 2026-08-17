# Groups: editorial until filtered

Bring the /blog control-row pattern to /groups: a compact masthead, one sticky search + filter bar, an editorial page underneath — and the moment any filter or query is active, the editorial sections collapse and the page becomes a clean results grid.

## What changes

**1. Sticky control row (new, shared by logged-in and logged-out)**
Directly under the masthead, sticky below the site header with a blurred background:
- Live search field on the left (typeahead over group names/cities, same feel as blog search) — types into the existing `q` param.
- Two equal-width dropdowns on the right: **City** and **Field** (fed from real group data, matching the existing `t`/`c` params).
- A **Sort** control kept alongside them (Featured / Most members / Most content / A–Z).
- A round **X** clear button appears only when something is active, resetting to the default state.
- Horizontally scrollable on mobile, no visible scrollbar.

**2. Editorial-until-filter behavior**
- **No filters active:** the page keeps its editorial rhythm — masthead, "Scenes to know" lead, activity ticker, "More to explore" rail, Cities, By medium, people rail, join CTA (logged-out) or the joined-groups rail and for-you sections (logged-in).
- **Any filter, query, or non-default tab active:** every editorial section is hidden. Below the sticky bar the page shows only a result count line ("42 scenes · Chicago · Film") and the full-width results grid, plus an empty state with a "Clear filters" action when nothing matches.

**3. Masthead tightening**
Reduce /groups masthead padding to match the tightened /blog masthead (`py-4 md:py-5`), keeping the eyebrow, headline, description, and the scenes/cities count chip. The redundant "Browse all" link is removed since search is now always in reach.

**4. Directory simplification**
The directory block currently carries its own search box, kind switcher, category select, sort select, and heading. Those controls move up into the sticky bar; the directory becomes a pure grid renderer driven by the URL state, so there is exactly one set of controls on the page.

## Technical notes

- New `src/components/groups/groups-control-row.tsx` holding the search input, City/Field/Sort selects, and clear button. It reads `DirectoryState` and calls the existing `onChange` / `onReset` handlers already wired in `src/routes/groups.index.tsx` — no URL schema change (`t`, `q`, `c`, `s` stay as-is).
- Search input is locally debounced (~200ms) before pushing to the URL so typing does not thrash navigation; existing `replace: true` navigation is preserved.
- `groups-directory.tsx`: strip the internal control block (search field, `GroupsKindSwitcher`, category/sort selects, eyebrow/heading props), keep `useAllPublicGroups`, the filter/sort logic, the grid, and the empty state. Export a small helper for "is the state filtered" so both homes agree.
- `public-groups-home.tsx` and `member-groups-home.tsx`: render masthead → control row → `filtered ? <results grid> : <editorial sections>`.
- Sticky offset mirrors blog: `sticky top-11 md:top-14 z-30` with `bg-background/80 backdrop-blur-md` and a bottom border.
- City options come from `kind === "city"` groups (sorted by member count); Field options from distinct `category` values via `categoryLabel`. Selecting a city sets `t: "city"` plus the matching filter; selecting a field sets `t: "genre"` and `c`.
- Styling uses existing semantic tokens (`border-border`, `bg-surface`, `text-ink-soft`) — no new colors.

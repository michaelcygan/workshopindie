# Optimize the Groups sticky filter bar

Groups currently has a sticky bar with Search · City · Field · Sort, and a second row of kind tabs (All / Your groups / Fields / Scenes / Micro / Cities) further down inside the results grid. Two problems:

1. The City dropdown is fake — picking a city writes the city name into the **search box**, so city and search fight each other and "Chicago" also matches any group whose text mentions Chicago.
2. The city list is a plain `<select>` of every city group, which does not scale as Workshop keeps launching localities.

This pass makes the bar the single place you steer the page, on both the logged-out and logged-in versions (they already share the same component, so parity is automatic).

## The new bar

One sticky row, left to right:

- **Search** — unchanged live search over names, taglines, mediums.
- **Kind** — the existing All / Your groups / Fields / Scenes / Micro / Cities tabs, moved up out of the results grid into the sticky bar as a segmented pill group so it stays reachable while scrolling. Counts stay next to the labels on desktop, drop on mobile for width.
- **City** — a real city filter (see below).
- **Medium** — the current Field dropdown, relabeled to Medium to match Workshop's prioritized taxonomy, ordered by group count.
- **Sort** — Featured / Most members / Most content / A–Z, unchanged.
- **Clear** — the round X, shown when anything is active.

Below the bar: a one-line result count ("128 scenes · Chicago · Film & Video"), replacing the duplicate count + "Clear filters" row currently sitting above the grid.

## The city picker

A popover pill, not a native select, built for long lists:

- Type-to-filter input at the top, matching on city name and country.
- A sticky **A–Z rail** down the right edge of the list; tapping a letter jumps to that section. Letters with no cities are dimmed and inert.
- Cities grouped under letter headers, each row showing the city name and its member count.
- "All cities" as the reset row at the top; the current selection is checked.
- Sourced from the already-loaded public groups list (city-kind groups), so no extra request. Keyboard accessible, closes on outside click / Escape.

## Filtering behavior

City becomes its own URL parameter, independent of search:

- Selecting a city filters to that city group **plus** every group tied to it, rather than only text-matching. Groups are matched to a city by their city group and by locality on the group record; the exact join is confirmed against the schema during implementation, and falls back to the city group itself if no reliable link exists.
- Search, City, Medium, Kind and Sort compose — any combination narrows the grid.
- Editorial-until-filtered stays: the featured/cities/mediums sections hide as soon as any filter is active.

## Technical notes

- `/groups` search schema gains `city` (`fallback(z.string(), "")`); `t`, `q`, `c`, `s` keep their current meaning and existing links stay valid.
- `DirectoryState` gains `city`; `GroupsControlRow`, `GroupsDirectory`, `PublicGroupsHome` and `MemberGroupsHome` thread it through — one code path, so logged-out and logged-in are identical.
- New `src/components/filter-header/filter-city-picker.tsx` added to the shared primitive so Events and Collabs can adopt the same picker later.
- `GroupsKindSwitcher` is replaced in the grid by the bar's segmented control; the component is removed if nothing else uses it.
- Styling uses existing semantic tokens and the `FILTER_PILL` height so everything lines up with Blog, Gallery and Events.

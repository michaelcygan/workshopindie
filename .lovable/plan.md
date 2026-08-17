# Gallery sticky filter bar — standardization pass

Bring `/gallery` in line with the bar that Blog, Groups, and Collabs now share: one line, same primitives, identical behavior logged in and logged out.

## What changes

Today Gallery has a hand-rolled toolbar: a scrolling field chip rail, a second row for Category + Subject, a custom expanding search button, a bespoke city dropdown, and a duplicated mobile-only row of tabs/sort/city. That gets replaced by the shared primitives.

New single-line bar (same order as Collabs):

- **Search** — `FilterSearch`, debounced, matches title/description.
- **Medium** — `FilterSelect` with counts (the current "fields": Music & Audio, Film & Video, Writing, Visual Art, Games & Tech). Relabeled from "All fields" to "All mediums" for consistency with Blog/Collabs/Groups.
- **City** — `FilterCityPicker` (type-to-filter + A–Z quick-skip rail), replacing `GalleryCityFilter`.
- **Sort** — `FilterToggleGroup`: Recent / Trending.
- **Filters** (sandwich popover, `FilterMore` with active-count badge) — Topic, Category (scoped to the selected Medium), Subject.
- **Clear** — `FilterClear` appears only when something is active.

The lens tabs (For you / Following / Favorites) stay, but move out of the filter bar into the masthead band directly under the "Gallery" title, so the sticky bar stays one line and the lens reads as navigation rather than a filter. Logged-out visitors see the same bar; Following/Favorites still route to sign-in on click.

Mobile: search on its own line, the control pills scroll horizontally underneath — the same pattern Collabs uses. The duplicated mobile-only tab/sort/city row is deleted.

## Data notes

- **Topic** filter is new on Gallery. Topics come from the existing `work_topics` join, loaded for the works in view (same approach as `useCollabTopics`), so the dropdown only lists topics that actually appear.
- **City** counts currently only include works with an explicit `city_id`. Same fix applied to Collabs: also count the author's home city so cities like Chicago appear, and match filtering with the same rule.

## Technical details

- `src/routes/gallery.tsx`: swap the custom toolbar for `FilterSearch` / `FilterControls` / `FilterSelect` / `FilterCityPicker` / `FilterToggleGroup` / `FilterMore` / `FilterMoreSection` / `FilterClear` from `@/components/filter-header`; add a `topic` search param (`fallback(z.string(), "")`); keep `q`, `tab`, `cat`, `kind`, `subject`, `city`, `sort` working so existing links don't break.
- Retire the local `searchOpen` state, `CategoryScroller` usage on this route, and the `GalleryCityFilter` import (component left in place if used elsewhere).
- City options move to a helper that also reads `works.user_id -> profiles.city_id`, mirroring `collabCityIds`.
- No schema changes, no changes to the works grid, cards, spotlight, or featured strips.

## Verification

Desktop and mobile, logged in and logged out: bar stays one line and sticks under the header, each filter narrows results, Filters badge counts correctly, Clear resets everything, and URL params round-trip on reload.

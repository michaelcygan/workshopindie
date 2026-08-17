# Sticky filter header as a shared UI primitive

Blog and Groups each grew their own version of the same idea: a compact masthead, then a sticky bar holding search plus a couple of filters, then content. Turn that into one reusable primitive and roll it out to Collabs, Gallery, and Events — each keeping its own filter controls.

## The primitive

A small set of composable pieces so every page's bar looks and behaves identically, while the contents stay page-specific:

- **FilterHeader** — the sticky shell: sticks below the site header (mobile and desktop), blurred translucent background, bottom hairline border, max-width row, horizontal scroll on mobile with no visible scrollbar.
- **FilterSearch** — the live search field: rounded pill, magnifier icon, inline clear button, debounced (~200ms) before it writes to the URL.
- **FilterSelect** — the dropdown pill used for Topic / Medium / City / Field / Sort, all one consistent width and height.
- **FilterToggle / FilterToggleGroup** — the segmented pill group (Upcoming/Past, For you/Following/Favorites, Recent/Trending) and single on-off pills (My RSVPs, Online only), styled to match the selects.
- **FilterClear** — the round X that appears only when something is active.
- **FilterMeta** — optional result-count line ("42 scenes · Chicago · Film").

## Rollout

**Blog** — swap its inline control row for the primitive. No visual change intended.

**Groups** — rebuild `groups-control-row` on the primitive, keeping its City / Field / Sort set and the editorial-until-filtered behavior.

**Gallery** — it already has a bespoke sticky toolbar. Move it onto the primitive so the offset, height, blur, and pill styling match the other pages. Keeps its tabs, field scroller, sort, city filter, expandable search, and Clear.

**Events** — the filter cluster currently scrolls away with the masthead. Move it into a sticky header: When (Upcoming/Past), My RSVPs, Format, Co-working, Daypart, plus a Clear control. Masthead padding tightened to match Blog/Groups.

**Collabs** — same treatment: field scroller, City, Online only, and Clear move into the sticky bar; the "based on your location" hint stays just below the content edge, not inside the bar.

## Notes

- No URL/search-param schema changes anywhere; each page keeps its existing params and handlers.
- Editorial-until-filtered stays a Groups/Blog behavior; Events and Collabs simply gain stickiness plus a result-count line. Gallery keeps its current content flow.
- Existing components (`CategoryScroller`, `CityCombobox`, `GalleryCityFilter`) are reused inside the bar rather than replaced.
- Shared files live under `src/components/filter-header/`; styling uses existing semantic tokens only.

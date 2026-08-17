# Events: standardize the sticky filter bar

Bring `/events` in line with Blog, Groups, Collabs, and Gallery: a compact editorial masthead that scrolls away, then a one-line sticky filter bar built from the shared filter primitives. Same bar logged in and logged out (the only logged-in extra is "My RSVPs").

## The bar (one line on desktop)

Left to right:

1. **Search** — debounced text search across event title, tagline, and venue name.
2. **Medium** — dropdown (All mediums / Music / Film & Video / Writing / Visual Art / Software & AI).
3. **City** — the standard city picker with live search and the A-Z quick-skip rail, showing only cities that actually have events, with counts. Replaces the current free-text "Anywhere — search a city" combobox.
4. **When** — Upcoming / Past segmented toggle.
5. **Format** — All / In person / Online segmented toggle.
6. **Co-working** — kept as its own pill, since it is a distinct event mode people look for directly.
7. **Filters** (overflow popover) — Time of day (Any / Morning / Afternoon / Evening), Topic, and "My RSVPs" on mobile.
8. **Clear** — appears only when something is filtered.

On mobile the search sits on its own line and the controls scroll horizontally below it, exactly like Gallery and Collabs.

## Masthead

The "Events" title, the "On the calendar / N happening now" chip, the one-line description, the upcoming count, and "Host an event" collapse into a single compact band above the sticky bar, matching Gallery. The "Near you / Based on your location" hint moves just under the bar so it no longer competes for space inside it.

## Notes on taxonomy

- **Medium** is real data today: events are already linked to the system medium groups (Writing, Music, Visual Art, Software & AI, Film & Video), so the dropdown filters against those links.
- **Topic** currently has no event tags at all in the database, so the Topic dropdown will render only when event topics exist. It lives in the Filters popover rather than the main line, so the bar stays honest about what is actually filterable.

## Technical details

- `src/routes/events.index.tsx`: replace the hand-rolled `FILTER_ROW_SCROLL` rows with `FilterHeader` + `FilterSearch` + `FilterControls` + `FilterSelect` / `FilterCityPicker` / `FilterToggleGroup` / `FilterMore` / `FilterClear`, mirroring the Gallery implementation.
- Search params gain `q` (string) and `medium` (slug), keeping the existing `when`, `format`, `city`, `cityName`, `mine`, `kind`, `daypart`. Existing shared links keep working.
- `listPublicEvents` / `listDiscoveryEvents` gain optional `q` and `medium` inputs: `q` as an `ilike` across title/tagline/venue_name, `medium` resolved through `event_groups` -> `groups.system_type = 'medium'`.
- New lightweight query for the city picker: distinct `venue_city_id` on discoverable events joined to `cities`, with counts, cached like the Gallery/Collabs city lists.
- The mini map keeps its `relative isolate z-0` wrapper so Leaflet controls stay under the sticky bar.
- Verify on desktop and mobile, logged out and logged in.

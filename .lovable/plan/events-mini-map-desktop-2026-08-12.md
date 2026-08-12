# Events mini map (desktop)

Fill the empty space next to "Featured events" on `/events` with a small, brand-styled map of the events currently in view.

## What it looks like

- Desktop (lg+): the Featured events block becomes a two-column band — the featured list on the left, a compact map card (~same height as the list, ~280px) on the right.
- The map is monochrome/light (Carto Positron tiles, no logos or clutter), rounded, bordered like other Workshop cards.
- Each in-person event with coordinates is a small cobalt dot. Hover shows the event title + date; click opens the event page.
- Map auto-fits to the events shown, respecting the active filters (city, upcoming/past, in person).
- Scroll-wheel zoom off by default (click to enable) so the page keeps scrolling naturally; zoom buttons available.
- Mobile: hidden by default to avoid stealing space (can be added later as a collapsible "Map" toggle if wanted).
- If no event in view has coordinates (e.g. Online filter), the map card is not rendered and the featured list spans full width.

## Technical notes

- New `src/components/events/events-mini-map.tsx`, modeled on the existing `src/components/venue-map.tsx`: Leaflet loaded via dynamic `import("leaflet")` inside `useEffect`, CSS injected once — never imported at module scope, so SSR stays safe.
- Tiles: `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png` with required attribution. Free, no API key, no Mapbox/Google.
- Markers are `L.circleMarker` styled with design tokens (cobalt fill, low-opacity halo sized by RSVP count) rather than default pin images, plus a small popup with title, date, and a link.
- Data comes from the already-fetched `/events` list (`listPublicEvents` already selects `venue_lat`/`venue_lng`) — no new server functions or queries.
- Layout change is contained to `src/routes/events.index.tsx` (wrap `FeaturedEventsCompact` in a grid) and the new component.

# Put real event locations on the Events map

Right now the mini map plots one bubble per city because no event in the database has coordinates: of 231 upcoming events, 195 have a street address but **zero** have `venue_lat` / `venue_lng`. So the map can only show "Chicago" and "Milwaukee" dots.

The fix is to turn those stored addresses into coordinates, then plot each event where it actually happens.

## 1. Geocode existing venue addresses

- Add an admin-only server function that walks events (and event series) that have a `venue_address` but no coordinates, and resolves each address through the existing OpenStreetMap/Nominatim provider already used by venue autocomplete.
- Respect Nominatim's rate limit (1 request/second, identified user agent), process in small batches, and cache by normalized address string so repeated venues (Platform Studios, Lion's Tooth, Eli Tea Bar) are only looked up once.
- Write results back to `venue_lat` / `venue_lng`; leave the row untouched and log a skip when the address can't be resolved confidently.
- Run it over Chicago and Milwaukee now, and expose a small "Geocode venues" action in `/admin/events` so future gaps can be filled without a code change.

## 2. Keep new events geocoded

- When an event is saved with a typed address that has no coordinates, resolve it server-side at write time, so the map stays accurate without another backfill.
- Recurring occurrences inherit the coordinates from their series.

## 3. Map shows events, not cities

- Switch the mini map back to one marker per event, using the event's own coordinates, sized by RSVP count.
- Hover shows title + date; click opens the event.
- When several events share a venue, group them into one marker whose popup lists them.
- Cities without any geocoded event still fall back to a city-level bubble so nothing disappears mid-backfill.
- The map fits to whatever is currently filtered (city, in-person, upcoming/past), so choosing Chicago zooms into Chicago venues.

## Technical notes

- Geocoding: reuse `src/lib/geo/provider.server.ts` (Nominatim, `WorkshopIndie/1.0` UA) rather than adding a vendor.
- New server function in `src/lib/group-events-admin.functions.ts` guarded by an admin role check; batch size and delay configurable, safe to re-run (idempotent — only touches rows where lat/lng is null).
- `src/components/events/events-mini-map.tsx` takes a union of event points and city-fallback points; Leaflet stays dynamically imported for SSR safety.
- `listEventMapCities` becomes `listEventMapPoints`, returning geocoded events plus per-city aggregates for the remainder.

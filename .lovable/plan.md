# In-Person Workshop Venues + Small Map

## API — Photon (keyless, free)

**Photon** (`https://photon.komoot.io/api/?q=...&limit=6`) — OSM-backed typeahead geocoder. No API key, no signup, CORS-enabled. Returns lat/lng + structured address (street, city, state, country, OSM id/type).

Fair use: 300ms debounce, AbortController on each keystroke, min 2 chars, limit 6 results. Fall back to a plain text input if Photon fails or rate-limits.

## Map — Leaflet + OSM tiles (keyless)

`react-leaflet` with OpenStreetMap raster tiles — no API key. Rendered as a **small ~280×280 square** card on the workshop detail page, never the page header. Static-ish: marker at the venue, modest zoom (~15), `scrollWheelZoom={false}` so it doesn't hijack scroll, a small "Open in OpenStreetMap" link below for directions. Skipped on the create form for now (typeahead only).

SSR-safe: dynamic-import the Leaflet bits inside a client-only wrapper so SSR doesn't crash.

## Schema additions

`public.workshops` — 5 new nullable columns (safe for existing rows):
- `venue_name text`
- `venue_address text`
- `venue_lat double precision`
- `venue_lng double precision`
- `venue_osm_ref text` (e.g. `node:1234`)

`city_id` already exists; we fill it from the resolved venue.

## Reusable `<VenueSearch />` component

`src/components/venue-search.tsx` — controlled typeahead on existing Popover/Command primitives. Debounced Photon fetch, result rows show `venue · neighborhood, city, country`. On select → emits `{ name, address, lat, lng, osm_ref, city: { name, state_region, country } }`. "Change venue" link to clear.

## Server function `resolveVenueAndCity`

`src/lib/venues.functions.ts` — takes the selected Photon payload, slugifies `{city}-{country_code}`, upserts the row in `public.cities`, returns `{ city_id, venue_* }`. Server-side so clients can't spoof `city_id`. Uses `requireSupabaseAuth`.

## Workshop create form (`workshops.new.tsx`)

When `locationType` is `in_person` or `hybrid`, swap the "Address or neighborhood" input for `<VenueSearch />`. Hybrid keeps its Call URL field. On submit:
1. Venue selected → call `resolveVenueAndCity`, merge returned fields into the insert (also write `location_text = venue_name` for back-compat).
2. `in_person`/`hybrid` with no venue → block submit with inline error.

## Workshop detail page (`workshops.$slug.tsx`)

For workshops with `venue_lat`/`venue_lng`, add a compact "Where" card in the sidebar/secondary column:
- Venue name (bold), address (muted)
- Small ~280×280 Leaflet square with a single pin
- "Open in OpenStreetMap" text link beneath the map

Online-only workshops: unchanged.

## City filtering — free win

`cities.$slug.tsx` already filters workshops by `city_id` — in-person/hybrid workshops will populate the matching city page automatically once hosts pick venues. Add a one-line caption: "In-person and hybrid workshops in {city}." for clarity.

## Out of scope

- Map on the create form
- Workshops index city filter chips
- Reverse geocode from a manually dropped pin

## Technical details

**New deps**: `leaflet`, `react-leaflet`, `@types/leaflet`. Leaflet's default marker icon needs a tiny `L.Icon.Default` fix (well-known one-liner) since Vite hashes its bundled PNGs.

**Files**:
- New: `src/components/venue-search.tsx`, `src/components/venue-map.tsx` (client-only Leaflet wrapper), `src/lib/venues.functions.ts`
- Edited: `src/routes/workshops.new.tsx`, `src/routes/workshops.$slug.tsx`, optionally `src/routes/cities.$slug.tsx` (one-line caption)
- Migration: 5 nullable columns on `workshops`

**Photon etiquette**: 300ms debounce, abort prior request, min 2 chars, `lang=en`, in-memory per-session cache by query string.

**City auto-create**: default **yes**. Slug = `slugify(city)-{country_code_lowercase}` (e.g. `brooklyn-us`, `lisbon-pt`). Say the word if you'd rather restrict to admin-curated cities.

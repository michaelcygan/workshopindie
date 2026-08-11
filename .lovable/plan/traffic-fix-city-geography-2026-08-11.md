# Traffic — Fix City Geography

## Wave 1 audit: confirmed root cause

Two independent problems, both outside the SQL:

1. **Ingestion never receives a city.** Both `/api/public/traffic` and `/api/public/traffic/live` call `coarseGeoFromHeaders(request.headers)`, which reads only `cf-ipcity` / `cf-region` / `cf-ipcountry`. Over the last 7 days: 269 pageviews, 161 with a country, **0 with a city, 0 with a region**. Cloudflare's optional visitor-location headers are not enabled on this deployment, but the Worker runtime exposes the same data on `request.cf`, which the code never reads.
2. **The Cities table dresses the country up as a city.** `admin.traffic.tsx` renders `[r.city, r.region, r.country].filter(Boolean).join(", ")`, so a row of `(null, null, "US")` prints as `US` under a column headed "City". Live Now does the same via `[c.city, c.region ?? c.country]`.

The SQL is correct and will not be touched: `traffic_locations()` groups by `city, region, country`; `traffic_countries()` groups by `country`; `traffic_live_snapshot()` groups live cities by `city, region, country`. No aliasing bug.

No backfill is possible — the missing city data was never stored.

## What changes

**Geography helper** (`src/lib/analytics/request.server.ts`)
- Add `coarseGeoFromRequest(request)` as the single shared implementation, keeping `coarseGeoFromHeaders` internally as the fallback path.
- Read Cloudflare metadata off the request first via a small local structural type (`Request & { cf?: {...} }`) — no new dependency. Priority: `cf.city` → `cf-ipcity` → null; `cf.regionCode` → `cf.region` → `cf-region-code` → `cf-region` → null; `cf.country` → `cf-ipcountry` → null. Same `clean()` normalization, country uppercased.
- Fully defensive: absent `request.cf` (local dev, preview, tests) silently falls back to headers, then null. Never throws, never guesses.

**Ingestion** — both `/api/public/traffic` and `/api/public/traffic/live` switch to `coarseGeoFromRequest(request)`. Identical behavior on both paths.

**Cities UI** (`src/routes/admin.traffic.tsx`)
- Shared formatter: city present → `Chicago, IL` (city alone when no region); city missing but country present → `Unknown (US)`; nothing → `Unknown`.
- Country expansion keeps the existing client-side filter over the already-loaded `locations` set — no new request. Child rows sorted by visits descending, with known cities ordered ahead of `Unknown`.
- Countries view and all country metrics unchanged.

**Live Now** (`src/components/admin/traffic-live-row.tsx`) — "Cities right now" uses the same formatter, so a country-only session shows `Unknown (US)`, never `US`.

## Out of scope / unchanged

All other metrics, panels, polling, sessions, bot filtering, tracking links, `/admin/geo`. No new tables, no IP/lat-long/postal/fingerprint storage, no third-party geo lookup, no permanent per-visitor geo logging.

## Verification

Typecheck plus a real production pageview after publish: confirm a fresh `traffic_pageviews` and matching `traffic_live_sessions` row carries city/region/country, then confirm Cities, Countries, country expansion, and Live Now all render correctly, including the `Unknown (US)` fallback on historical rows.

Operational note (not a correctness dependency): if `request.cf` turns out to be unavailable in this Worker runtime, enabling Cloudflare's visitor-location transform headers on the zone would restore city data through the header fallback. I'll report which source is actually supplying the data after verification.

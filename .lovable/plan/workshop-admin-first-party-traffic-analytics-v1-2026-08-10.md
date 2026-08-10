# Workshop Admin — First-Party Traffic Analytics (V1)

A small, privacy-conscious traffic primitive: who arrives, what they look at, where they came from, how they move. Separate from Growth, Product, Geography and Tracking Links.

## What the audit found

- Admin analytics all go through one server-function module (`src/lib/admin-analytics.functions.ts`), each query wrapped in a failure-aware `panel()` envelope (`ok` / `empty` / `unavailable`) from `src/lib/analytics/envelope.ts`. Reads run through the service-role client after an explicit admin-role check.
- Admin UI reuses `Metric`, `RatioMetric`, `SectionHeading`, `UpdatedAt`, `Unavailable` (`src/components/admin/metric.tsx`) and `MetricChart` (recharts, single series per chart). Admin nav lives in `src/routes/admin.tsx` under an "Analytics" group: Growth · Product · Marketplace · Geography · Revenue.
- `src/lib/tracking-links.server.ts` already exports exactly the privacy helpers we need: `isLikelyBot(userAgent)`, `referrerHost(referer)`, `coarseGeoFromHeaders(headers)` (cf-ipcity / cf-region / cf-ipcountry), plus a service-role client factory. No IP, no fingerprint, measurement failure never breaks the redirect.
- Root shell (`src/routes/__root.tsx`) already mounts global background behaviors (`RefCapture`, `TrackingClickAttribution`, `PresenceHeartbeat`) — `<TrafficTracker />` slots in beside them.
- `/go/$slug` is a server-only redirect route (`go.$slug.ts`), so it never renders a page and cannot generate a pageview. Nothing to special-case beyond the denylist.

## Waves

**Wave 1 — Shared helpers (no behavior change)**
Extract `isLikelyBot`, `referrerHost`, `coarseGeoFromHeaders`, and the admin-client factory into a shared server-only module; tracking links re-export/import from it so there is one implementation.

**Wave 2 — Database**
Migration creating `public.traffic_pageviews`: `id`, `visitor_id`, `session_id`, `path`, `route_pattern` (nullable), `visitor_type` ('guest'|'member'), `referrer` (host only, nullable), `city`/`region`/`country` (nullable), `viewed_at`. RLS enabled with **no** policies for `anon`/`authenticated`; `GRANT ALL` to `service_role` only, so writes/reads only happen through server code. Indexes: `viewed_at`, `(viewed_at, session_id)`, `(viewed_at, path)`, `(session_id, viewed_at)`.

**Wave 3 — Ingestion endpoint**
`POST /api/public/traffic` (TanStack server route). Zod-validated body: `{ visitorId, sessionId, path, routePattern?, visitorType }`. Server strips query/hash, enforces the route denylist, rejects obvious bots, derives referrer host + coarse geo from request headers, inserts best-effort. Always returns 204, never an error the client acts on. Geography is never accepted from the browser.

**Wave 4 — Global TrafficTracker**
One component in `__root.tsx` subscribing to router navigation. Fires on initial load, link/router navigation, back/forward and refresh; deduped by pathname so query-only changes (`/groups?t=city` → `?t=genre`) do not re-count. Guarded against StrictMode/hydration double-fire with a last-recorded-path ref. `sendBeacon` when available, small `fetch` with `keepalive` otherwise — fire-and-forget, never awaited before navigation.

**Wave 5 — Visitor and session identity**
`workshop_visitor_id` (crypto UUID) in localStorage; `session_id` + `last_activity_at` in sessionStorage/localStorage with a 30-minute inactivity rollover. All storage access wrapped in try/catch — unavailable storage degrades to an in-memory ID for the tab, never throws. Documented as one browser, not one human; no fingerprinting.

**Wave 6 — SQL aggregations**
Security-definer functions taking a `days` argument (0 = all): `traffic_overview`, `traffic_daily`, `traffic_pages`, `traffic_locations`, `traffic_referrers`, `traffic_entries`, `traffic_exits`, `traffic_transitions` (window functions over `session_id, viewed_at`, self-transitions excluded, top 30). Execute granted to `service_role` only. Bounce = sessions with exactly one pageview. Verified against a deterministic fixture (3 sessions / 6 views → 6 views, 3 visits, 33.3% bounce, 2.0 pages/visit).

**Wave 7 — Admin server function**
`getAdminTraffic({ days })` in the existing analytics module: admin-gated, each RPC wrapped in `panel()`, returns `{ overview, daily, pages, locations, referrers, entries, exits, transitions, fetchedAt }`. No raw rows to the browser.

**Wave 8 — `/admin/traffic` UI**
New route, added first in the Analytics nav group (Traffic · Growth · Product · Marketplace · Geography · Revenue). One shared 7d/30d/90d/All control (default 30d) driving every section. Headline metrics (Page views, Unique visitors, Visits, Pages/visit, Bounce rate with definition tooltips), daily page-views chart, then Pages, Sources, Locations, Entry pages, Exit pages, Common paths — all in existing admin components, with `Unavailable` on failed panels rather than a false zero. Locations carries a note that it is coarse edge visitor geography, distinct from `/admin/geo` member geography.

**Wave 9 — Privacy, security, regression**
Verify nothing persists IP, user id, query strings, hashes, full referrers or private paths; verify admin-only reads; run typecheck, tests and production build, and re-walk `/go/:slug`, Growth, Geography and mobile nav for regressions.

## Notes and deferred items

- Retention (e.g. 12-month pruning) is documented as follow-up unless a scheduler already exists; V1 does not add deletion infrastructure.
- Visitor-to-signup attribution is explicitly out of scope.
- Route pattern comes from the router's matched route id where reliable, and stays nullable when it isn't.

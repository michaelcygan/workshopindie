# Traffic — Minimal Realtime Layer

Add a compact "live now" layer on top of the existing `/admin/traffic` page without touching the historical analytics architecture. Plus two small UI polish items (Cities/Countries toggle, expandable countries) that use data already loaded.

## What you'll see

Directly under the five headline metrics, one dense row:

```text
● 8 LIVE NOW · 6 guests / 2 members    Most active: Chicago 4 · Blog 2 · Home 2
```

"8 LIVE NOW" is a button that opens a small popover with: most active pages (top 8), cities right now, arriving-from sources, and the member/guest split. No charts, no map.

The five headline numbers refresh themselves every ~12 seconds while the tab is visible, with a quiet `● LIVE · updated 4s ago` marker. Daily chart, Pages, Entry/Exit, Common paths, Locations and Countries stay bound to the current 7d/30d/90d/All selection and are not re-queried on the realtime timer.

Locations section becomes a `Cities | Countries` toggle (Cities default) over the two panels that are already fetched. In Countries, a country row expands to show its cities sorted most-to-least visits, filtered client-side from the already-loaded locations array — no new request.

## How it works

```text
TrafficTracker ──every 60s while visible──> POST /api/public/traffic/live
                                                     │ UPSERT
                                            traffic_live_sessions
                                                     │
                                            traffic_live_snapshot()
                                                     │ every 10s
                                            /admin/traffic live row
```

## Technical detail

**Migration**
- `public.traffic_live_sessions(session_id uuid primary key, visitor_type text, path text, city/region/country text null, source text null, last_seen_at timestamptz not null default now())` plus an index on `last_seen_at`. No user id, no IP, no query string. RLS enabled with no policies (service role and the SECURITY DEFINER RPC only); GRANT to `service_role`, `EXECUTE` on the RPC to `authenticated` only.
- `traffic_live_snapshot()` — SECURITY DEFINER, `stable`, returns a single `jsonb`: `total`, `members`, `guests`, and top-8 `cities`, `pages`, `sources`, all filtered to `last_seen_at >= now() - interval '2 minutes'` (matching `ONLINE_WINDOW_MS`). Deletes nothing; stale rows simply stop qualifying. Existing daily sweep pattern gets a line to prune rows older than a day.
- Optional `heating_up`: computed inside the same RPC as one extra `traffic_pageviews` scan comparing last 10 minutes vs the 10 before, joined onto the top pages. Included only if it stays a single small CTE; dropped otherwise.

**Heartbeat endpoint** — new `src/routes/api/public/traffic/live.ts`, a near-copy of the existing ingestion route: same bot filter, same `coarseGeoFromHeaders`, same `measurementAdminClient`, same "always return 204" contract. Body `{ sessionId, visitorType, path, source? }` validated with Zod, path run through `normalizeTrafficPath` / `isExcludedTrafficPath`, then UPSERT on `session_id`.

**Tracker** — extend the existing `<TrafficTracker />` (no second global component). A second effect sends a heartbeat on mount, on `visibilitychange` back to visible, and on a `HEARTBEAT_INTERVAL_MS` (60s) timer, only while `document.visibilityState === "visible"`; cleared on unmount. Reuses `getSessionId()` and the existing fire-and-forget send helper in `src/lib/traffic/identity.ts`. Every failure is swallowed.

**Server functions** — in `src/lib/admin-analytics.functions.ts`, next to `getAdminTraffic`:
- `getAdminTrafficOverview({ days })` — `requireAdmin`, then only `traffic_overview` in the same `panel()` envelope.
- `getAdminTrafficLive()` — `requireAdmin`, then only `traffic_live_snapshot()`.

**Page** — `admin.traffic.tsx` keeps its existing `getAdminTraffic` query untouched as the initial/fallback source. Two new `useQuery`s: overview at `refetchInterval: 12_000`, live at `10_000`, both with `refetchIntervalInBackground: false`. Headline metrics read the fresher overview when present, otherwise the historical payload. New `src/components/admin/traffic-live-row.tsx` holds the dense row and the popover (existing `@/components/ui/popover`). A small `src/lib/traffic/page-label.ts` maps a handful of static paths (`/` → Home, `/blog` → Workshop Blog, `/groups` → Groups) and `/g/<slug>` → title-cased slug; anything else falls back to the raw path. No per-row database lookups.

If the live queries fail, the row hides itself and the rest of Traffic is unaffected.

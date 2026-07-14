# Real content in the homepage globe pill

Turn the animated arcs on the landing globe into a live discovery surface: each arc + pill promotes a real Work, Collab, or Group, and the pill links straight to that page.

## What lands on the globe

Three item types, mixed into the rotation, each with its own icon + accent color so it reads as a distinct "kind" from across the page:

- **Work** — coral dot (current look), pill text: `{city} → {city} · {work title}`, links to `/works/{slug}`.
- **Collab** — orange megaphone glyph, pill text: `{city} → {city} · Open collab: {title}`, links to `/collabs/{slug}`.
- **Group** — rose drop-pin glyph on origin city, pill text: `{city} · {group name}` (single pin, no arc), links to `/groups/{slug}`.

The pill is a real `<a>` (or `<Link>`), gets `pointer-events: auto`, and shows a subtle hover state so it reads as clickable.

## City coordinates (why we don't need a migration)

`public.cities` exists with `latitude`/`longitude` columns, but every row currently has `NULL` coords, so the DB can't drive the globe today. Rather than block on backfilling, ship a curated client-side lookup keyed by city name (~120 common creative-industry cities worldwide, extending the existing `CITIES` map in `world-arcs.tsx`). Any city name that resolves to coords is used as-is; anything unknown gets a **random** known city as the origin, exactly as the request describes. The destination is always a random known city different from the origin.

Later, if `cities.latitude/longitude` get backfilled, the component will prefer DB coords automatically — no schema change is required now.

## Data flow

New hook `useGlobePromos()` (client-only, no server function needed — everything is public read):

- `works`: latest ~15 published works with joined city name (`works` + `cities`, `status = 'published'`, order by `created_at desc`).
- `collabs`: latest ~10 open collabs (`collab_posts` + `cities`, `status = 'open'`, order by `created_at desc`).
- `groups`: latest ~10 visible groups with a city (`groups` + `cities`, `visibility = 'public'`, `deleted_at is null`).

Cached via TanStack Query (5 min stale). Results shuffled into a single `promos[]` list weighted ~ 3 works : 2 collabs : 1 group so Works dominate but discovery stays varied.

`WorldArcs` gets an optional `promos` prop. When empty (still loading, or truly nothing published), it falls back to the current hand-authored `PAIRS` so the hero never looks broken.

## Rendering changes in `world-arcs.tsx`

- Replace static `PAIRS` cycle with `promos` when provided; each promo carries `{ kind, title, href, from, to? }`.
- Arc slot logic unchanged for `work` / `collab`. `group` slots skip the arc: only the origin dot pulses (drop-pin motif).
- Landing dot color per kind: work = coral (current), collab = warm orange, group = rose.
- Pill HTML built per kind with a leading inline SVG glyph (megaphone / pin) and the correct href. Pill root gets `pointer-events-auto`, `hover:bg-surface`, `hover:shadow-md`.
- Only one pill visible at a time (current behavior preserved); when the pill's arc fades out, so does the pill.

## Files touched

- `src/components/world-arcs.tsx` — accept `promos`, per-kind rendering, clickable pill, expanded city coord map.
- `src/lib/globe-promos.ts` *(new)* — `useGlobePromos()` hook + shuffling/weighting + city-name → coords resolver.
- `src/routes/index.tsx` — call the hook, pass `promos` into `<WorldArcs />`.

No DB migration, no new server function, no RLS change (all three tables already permit public reads for these filters).

## Out of scope

- Backfilling `cities.latitude/longitude` (separate task; component is forward-compatible).
- Personalization / "near you" ranking.
- Image thumbnails inside the pill (kept text-only to stay lightweight over the canvas).

## Known limitations

- Cities not in the curated coord map get a random origin, so the arc's geography is illustrative, not literal, until DB coords are backfilled.
- With very few published items, the same promos will repeat within a session; the fallback to hand-authored `PAIRS` only triggers when *all three* queries return empty.

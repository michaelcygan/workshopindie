## Goal
Add a calm, Stripe-style world map animation to the homepage hero — a tilted, minimal hemisphere with slowly drifting dot-arcs between cities and small pin labels that fade in/out describing the connection (e.g. "Lagos → Berlin · Score").

## Approach: pure SVG, no heavy libs
- One new component `src/components/world-arcs.tsx`.
- Render a **dotted hemisphere** as background: thousands of small circles placed on a sphere projection (orthographic), filtered to land only using a low-res GeoJSON of country outlines. Land dots are slightly darker / more saturated; ocean is empty. This gives the Stripe/Mercury "particle continents" look.
- The sphere is **tilted ~20° and rotates very slowly** on the Y axis (full rotation ~120s) via a single `requestAnimationFrame` loop that recomputes projected dot positions. Use `d3-geo`'s `geoOrthographic` projection (tiny, ~15kb) + a pre-baked land GeoJSON in `src/assets/land-110m.json` (Natural Earth 110m, ~80kb gzipped) for the land mask test.
- Above the dots, render **animated arcs** between pairs of cities:
  - Use `geoInterpolate` to get great-circle arcs, sample 64 points, project each to 2D, draw as an SVG `path`.
  - Animate `stroke-dasharray` so each arc draws over ~2.5s, holds briefly, then fades. Stagger arcs with a 1.5s offset.
  - At each arc endpoint, drop a small ring + pulse circle (the "pin").
  - When the arc completes, show a **small pill label** near the destination pin with the connection metaphor — fades in for ~3s, then out. Examples (since this is aspirational/global-adoption framing): "Lagos → Berlin · Scoring a short film", "São Paulo → Tokyo · Co-writing a track", "Mexico City → Lisbon · Cover photography", "Nairobi → Toronto · Edit pass".
- Cull arcs/pins that fall on the **far side** of the globe (z < 0 in orthographic) so the animation stays clean as the sphere rotates.

## Styling
- Land dots: `bg → primary` blend, low opacity (~0.35–0.55), 1px radius.
- Arcs: 1px stroke, gradient from `--primary` to `--accent` (using a single `<linearGradient>`).
- Pin labels: small rounded surface chip with city + verb, matches existing `border-border bg-surface` aesthetic.
- Respect `prefers-reduced-motion`: stop rotation, show 2–3 static arcs only.
- Fully responsive: SVG `viewBox`, contains itself, no layout shift.

## Hero integration
- Edit `src/routes/index.tsx`. Mount `<WorldArcs />` in the hero section as a soft visual layer between the cream veil and the text — `absolute inset-0 -z-[5] opacity-[0.9]` (above EtherealBackground, behind text). Hero copy stays unchanged.
- On mobile (`< md`), shift the globe so its center sits below the headline (translate-y) so it acts as a backdrop without competing with type. On desktop, keep it centered behind the hero.

## Performance
- ~1,200 land dots, pre-computed once at mount; only the transform (rotation matrix) is updated per frame — no DOM diffing of every dot. Render dots into a single `<canvas>` layered behind the SVG (canvas for dots = cheap; SVG for arcs/pins/labels = crisp + interactive). This is the same split Stripe uses.
- ~4 active arcs at any time; pool of 12 city pairs cycled.
- Pause rAF when the hero section is not in viewport (`IntersectionObserver`).

## New deps
- `d3-geo` (~30kb), `topojson-client` (only if I ship the land as TopoJSON; GeoJSON avoids it). I'll ship GeoJSON to skip topojson-client.

## Files
- create `src/components/world-arcs.tsx`
- create `src/assets/land-110m.json` (Natural Earth low-res land outlines)
- edit `src/routes/index.tsx` (mount in `Hero`)
- `bun add d3-geo @types/d3-geo`

## Out of scope (good followups, not now)
- Real connection data from the network (hook arcs to actual Collab matches once there's volume).
- Click an arc → open that Collab.
- Dark-mode tuning beyond what semantic tokens already give.

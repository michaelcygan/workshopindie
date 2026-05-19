## What's wrong

1. **10s blank → pop-in.** `WorldArcs` runs 6,000 `geoContains` tests synchronously inside `useMemo` on first render. That blocks the hero's first paint until the land mask is built, then the parent re-renders.
2. **Every frame re-renders the whole component.** `setLambda` + `setNow` fire on every `requestAnimationFrame`, so React re-runs `WorldArcs`, rebuilds `projection` (useMemo deps include `lambda`), recomputes 12 arc features and re-renders the canvas effect. That's why arcs "lag" and the page feels heavy.
3. **Arc scheduling is wrong.** `((now - i*STAGGER) % (CYCLE * PAIRS.length))` gives each pair a single 7s window inside an 84s period — so you see a burst of arcs at start, then nothing for a minute, then another burst. Matches the "fire too quickly… then long time to reload" complaint.
4. **Layout covers the text.** The globe is centered (`max-w-[1100px] mx-auto`) over the hero, so on desktop it sits behind the headline and squeezes the "Show your Work" / CTA area visually. Per screenshot 2, you want the headline + buttons back to their original centered full-width layout, with the globe as a softer backdrop offset to the left.

## Fix plan

### A. Move all animation off React state (the big perf win)

Rewrite `src/components/world-arcs.tsx` so React renders the `<canvas>` + a single `<svg>` shell **once**, and a single rAF loop drives everything imperatively:

- Keep `lambda`, `now`, and per-arc state in **refs**, not `useState`.
- One canvas, drawn each frame: sphere fill + land dots + arcs + pins. Drop the SVG arc/label path entirely — draw arcs and pin glows on canvas, only render the small text pill labels in the DOM (positioned via `style.transform` updates on a ref'd `<div>`, no React re-render).
- Recompute `projection.rotate([-lambda, -18, 0])` inside the rAF tick (cheap), not via `useMemo`.

Expected: 0 React renders/sec during animation instead of ~60.

### B. Don't block first paint on the land mask

- Lower dot count to **~2,500** (visually identical at hero size).
- Build the land-dot array **after first paint**: render the hero immediately, then in a `useEffect` schedule the build via `requestIdleCallback` (fallback `setTimeout 0`). The canvas shows the sphere + arcs immediately; dots fade in once ready (~150ms on a normal laptop with 2.5k samples vs ~1–2s with 6k).
- Even better: chunk the geoContains loop across a few frames (process 500 points per frame) so the main thread never stalls.

### C. Fix arc timing

Replace the global cycle math with **independent per-arc timers**:

- Keep a pool of 3 concurrent arcs.
- Each arc has lifecycle: draw-in 1.4s → hold 1.6s → fade-out 0.8s → cooldown 0.6s → pick next pair. Total ~4.4s per arc, 3 active staggered by ~1.5s → smooth, continuous rhythm. No 80s dead zones, no bursts.
- Cycle through `PAIRS` round-robin so every connection eventually shows.

### D. Restore full-width hero text, push globe to backdrop

In `src/routes/index.tsx` `Hero`:
- Remove `max-w-[1100px] mx-auto` from the `WorldArcs` wrapper.
- Position the globe **left-anchored and partially off-canvas** on desktop so it reads as ambient backdrop, not a centered competing element. Concretely: `absolute -left-[10%] top-1/2 -translate-y-1/2 h-[110%] w-[70%] opacity-70 -z-[5]` on `md+`, and on mobile drop it below the headline (`top-[55%] left-0 w-full h-[60%] opacity-50`).
- Headline + CTA grid keep their existing `max-w-6xl … text-center` and `md:grid-cols-2`, so "Find people. Make the thing. Show your Work." + the two CTA cards return to the full-width centered layout from screenshot 2.
- Bump the cream veil opacity slightly on the right side (radial mask) so type contrast over the globe stays clean.

### E. Misc

- Respect `prefers-reduced-motion`: render dots + 2 static arcs, no rAF.
- Pause rAF via `IntersectionObserver` (already exists — keep).
- Drop the `<foreignObject>` labels (they force SVG layout on every frame). Use a single absolutely-positioned `<div>` whose `transform` is set imperatively.

## Files

- edit `src/components/world-arcs.tsx` — full rewrite along the lines above.
- edit `src/routes/index.tsx` — reposition `<WorldArcs />` wrapper classes only; headline/CTA markup unchanged.

## Out of scope

- Replacing `EtherealBackground` blur stack (separate concern; not the slow part here).
- Real connection data.

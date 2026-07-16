Give the mobile medium tiles subtle life — a slow cross-fade slideshow through that medium's covers with a gentle Ken Burns zoom/pan. Presentation-only, mobile tiles only, no data changes.

## Scope
- File: `src/routes/u.$username.tsx` only.
- Affects the mobile `showMobileTiles` block inside `WorksTab` (the Film / Music / Books tiles). Desktop layout untouched.

## New internal component: `CategoryTileMedia`
Small component defined in the same file. Props: `covers: string[]` (deduped, ordered pinned-first then recent), `className?`.

Behavior:
- Picks up to 5 covers for the category from `pinnedWorks` + `roleFiltered` (existing arrays already in scope), deduped, dropping any without a `cover_url`. Falls back to the existing colored panel when there are 0 covers, and stays static when there is exactly 1.
- Renders each cover as a stacked `<img class="absolute inset-0 h-full w-full object-cover">`; the "active" one has opacity 1, others 0, transitioning with a plain CSS `transition-opacity duration-700`.
- A single `setInterval` advances the index every ~5s. Only one interval per tile; cleared on unmount and paused via `document.visibilityState === "hidden"` so background tabs don't churn.
- Ken Burns: apply `animation: kenburns 12s ease-in-out infinite alternate` to the active image. Two keyframes only (`scale(1) translate(0,0)` → `scale(1.06) translate(-1.5%, -1%)`) — very subtle drift + slight zoom.
- Respects `prefers-reduced-motion`: no interval, no keyframes; renders the first cover statically.
- `loading="lazy"` on all imgs; `decoding="async"`; `draggable={false}`.

## Wiring in `WorksTab`
Replace the single-cover `<img>`/color-block inside the existing tile button with `<CategoryTileMedia covers={...} />`. Everything else about the tile (aspect ratio, rounded corners, bottom gradient, label pill, count pill, tap handler) stays exactly as it is.

## CSS
Add the `@keyframes kenburns` block once in `src/styles.css` (top-level, after existing keyframes if any) so no Tailwind config changes are needed.

## Non-goals
- No new data fetch, no schema/RLS changes, no new deps, no changes to `WorkCard`, desktop grid, or the chip scroller.
- No autoplay video, no parallax on scroll, no per-tile audio — just cross-fade + slow Ken Burns.

## Verification
- Playwright at 375×812 on a profile where Film and Music each have 2+ covers: capture the tile at frame 0 and again after ~6s; the active cover changes and the crop drifts subtly.
- Category with exactly 1 cover: no fade, gentle Ken Burns only.
- Category with 0 covers: colored fallback panel, no motion.
- With `prefers-reduced-motion: reduce`: static first cover, no animation.
- Desktop 1280×900: pixel-identical.

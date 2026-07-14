## Soft Ken Burns on Gallery thumbnails

Add a slow, subtle Ken Burns pan/zoom to `WorkCard` cover images so tiles with off-aspect artwork (e.g. YouTube 16:9 in a 4/5 tile, book covers in a 16:10 hero) feel alive. Pauses on hover so the existing `group-hover:scale-[1.03]` lift stays the primary interaction.

### Motion spec

- Duration: 22s, `ease-in-out`, `alternate infinite` — imperceptible drift, never a loop pop.
- Transform: scale 1.06 → 1.12 combined with a small translate (~2% x, ~1.5% y) so it pans as well as zooms.
- Respects `prefers-reduced-motion` — reduces to a static `scale(1.03)` with no animation.
- Pauses on `group-hover` (card) so hover cleanly hands off to the existing 500ms `group-hover:scale-[1.03]` transform without fighting.
- Honors `focalStyle(cover_focal_x, cover_focal_y)` by keeping `object-position` from the focal point; the transform-origin follows the same focal point so the pan stays centered on the subject.

### Where it applies

Single source of truth: `src/components/work-card.tsx` (used by Gallery, home rails, profile grids, etc.). No other cover surfaces change in this pass — `fresh-works-strip`, hero covers on work detail, room gallery, etc. remain untouched to keep scope tight. If you want it extended to those next, we can do a follow-up.

### Technical details

1. Add a `@keyframes ken-burns` and a `.ken-burns` utility class in `src/styles.css` (alongside existing animations). Keyframes go from `scale(1.06) translate(-1%, -0.75%)` to `scale(1.12) translate(1%, 0.75%)`, `animation: ken-burns 22s ease-in-out infinite alternate`.
2. Add `.group:hover .ken-burns { animation-play-state: paused; }` and a `@media (prefers-reduced-motion: reduce)` block that disables the animation and applies a static `transform: scale(1.03)`.
3. In `WorkCard`, add `ken-burns` to the `<img>` className. Set `transform-origin` inline from the focal point (fallback 50%/50%) so the zoom stays anchored to the subject.
4. Keep existing `transition-transform duration-500 group-hover:scale-[1.03]` — on hover the keyframe pauses and the hover scale takes over via transition.

### Out of scope

- No changes to `fresh-works-strip`, work detail hero, room gallery, or any non-`WorkCard` cover surface.
- No new props, no per-card opt-out, no config surface.
- No changes to focal-point picker or cover framer logic.

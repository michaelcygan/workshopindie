# Featured Stories: unlimited set + calmer rotation

## What changes for you

- Admin can feature as many posts as you want — the current 5-post limit goes away.
- The Featured Story lead cycles through the **entire** featured set, not just the first three.
- Timing feels ambient instead of metronomic: each slide holds for a random 6.5–10s.
- The cobalt progress hairline becomes much fainter and thinner in feel.
- The crossfade gets slower and softer, with a smaller vertical drift.

## Behavior details

- Lead slot rotates through every featured post (newest-first order preserved).
- The two secondary stories under the headline continue to show the next two items in the rotating order, so they shift along with the lead.
- Pause rules stay as-is: hover, keyboard focus, off-screen, hidden tab, reduced motion.
- If fewer than 3 posts are featured, the set is still topped up with the newest posts (unchanged fallback).

## Technical notes

- `src/components/home/public-featured-stories.tsx`
  - Replace fixed `ROTATE_MS` with a per-cycle random interval in `[6500, 10000]` using `setTimeout` re-scheduled on each advance (instead of `setInterval`).
  - Drive the progress bar duration from that same random value via an inline `animationDuration` style so bar and slide stay in sync.
  - Progress bar: `bg-primary/50` → `bg-primary/20`, and drop it to a soft, near-invisible hairline.
  - Crossfade: duration `700ms` → ~`1100ms`, easing to a gentler curve, translate `8px` → `4px`.
  - `featured-rise` usage on lead/secondary links slowed to ~`900ms` with the smaller offset.
  - Only render/prefetch offscreen slides that are adjacent in the rotation, so an unlimited set doesn't mount dozens of `<img>` layers.
- `src/styles.css`: soften `featured-rise` translate; keep `featured-progress` (duration now inline).
- `src/lib/blog.server.ts`: remove the `FEATURED_POST_CAP` guard in `adminSetPostFeaturedServer` (no error when featuring more).
- `src/lib/home.server.ts`: remove `.limit(FEATURED_POST_CAP)` on featured queries (use a sane hard ceiling like 24 to bound payload); keep the top-up-to-3 fallback for the empty case.
- `src/routes/blog.index.tsx`: header set becomes all featured posts (fallback: first 3), and Latest/More/Archive slices exclude whatever the header consumed so nothing duplicates.
- `src/components/home/public-home.tsx`: pass the full featured set instead of `.slice(0, 3)`, with the same de-dupe against Latest.

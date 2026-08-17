# Rotating feature showcase on /blog

Turn the big lead story + right-hand list into one connected, rotating module: the large panel cycles through the items in the list, and the active item is highlighted.

## Behavior

- Source: featured posts first (unlimited list, contained in this module and excluded from the feed below). If there are no featured picks, fall back to the most recent published posts — those latest posts continue on down the page as they do today.
- Rotation: auto-advance every ~8s (same cadence as the homepage), pauses on hover/focus and when the tab is hidden, respects reduced-motion.
- Interaction: clicking or keyboard-focusing a right-hand item makes it the big panel immediately and restarts the timer; the title/image still links through to the post.
- Active state: the current item in the right list is marked (rule/marker + stronger title), plus a thin progress bar on the large cover.
- Transitions: cross-fade on the cover, quick fade/slide on the headline block — no layout shift, fixed 16:10 cover ratio.

## Mobile

- Same module becomes a swipeable horizontal carousel of the rotating items (snap scrolling, dot indicators), still auto-advancing on the same timer and pausing while the user is touching/dragging.
- Below the carousel the feed continues unchanged.

## Technical notes

- Rework `BlogLatestStories` in `src/components/blog/blog-editorial-sections.tsx` into a client component with `activeIndex` state, an interval driven by a `useEffect`, `IntersectionObserver` so it only rotates while visible, and `prefers-reduced-motion` guard.
- Rotation list is built in `src/routes/blog.index.tsx`: `featured.length > 0 ? featured : cards.slice(0, N)`. When featured drives the module, keep the existing exclusion of featured IDs from `rest`; when falling back to latest, do not exclude — the same posts continue in the feed.
- The module is hidden when filters are active (current `filtered` behavior kept), and `PublicFeaturedStories` on /blog is replaced by this single showcase so featured content is not rendered twice.
- Images: first slide eager with `fetchpriority="high"`, the rest lazy and preloaded one ahead to avoid a flash on rotate.
- Cards render deterministically (no `Date.now()`/random in render) so SSR output matches hydration.

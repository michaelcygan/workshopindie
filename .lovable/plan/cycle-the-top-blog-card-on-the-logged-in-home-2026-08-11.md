# Cycle the top Blog card on the logged-in home

## What happens today

The card under the greeting is already a small carousel, but it only cycles when an admin has flagged posts as Featured. With nothing featured, the server sends exactly one post (the newest), so the card sits still. When it does move, it slides sideways every 8 seconds.

## What changes

- **Always five posts.** The card is fed up to 5 posts: any featured ones first, then the most recent published posts to fill out the set (no duplicates). So it cycles even when nothing is featured.
- **Slower, calmer rhythm.** Advance every 5 seconds instead of 8.
- **Elegant dissolve.** Replace the sideways slide with a cross-dissolve: the outgoing post fades out while the incoming one fades in with a very slight lift and image scale settle — closer in feel to the Workshop Now board than a filmstrip.
- Keeps everything that already works: dots and arrows, pause on hover/focus/touch and when the tab is hidden, swipe on mobile, and no auto-advance for visitors who prefer reduced motion (they get an instant swap).
- Label stays honest: "Featured from the Blog" when the set is admin-curated, "Latest from the Blog" when it is just recency.

## Technical notes

- `src/lib/home.server.ts` — `featuredBlogServer()`: fetch featured posts (cap 5), then top up from the same base query ordered by `published_at desc`, filtering out ids already present, to reach 5. `isFallback` stays true only when there were no featured posts at all.
- `src/components/home/home-featured-blog.tsx`: `INTERVAL_MS` 8000 → 5000. Swap the `translateX` filmstrip for a stacked grid (all slides in one `grid` cell, `grid-area: 1/1`), with the active slide at `opacity-100`, others `opacity-0 pointer-events-none`, `transition-opacity duration-700 ease-out` plus a small `translate-y-1` → `translate-y-0`. Keep `aria-hidden`/`inert` on inactive slides; skip the transition when `reduceMotion`.
- Container height comes from the active slide; keep the existing `min-h-[132px]` on the slide so the stack does not jump between posts with different excerpt lengths.
- No database or schema changes.

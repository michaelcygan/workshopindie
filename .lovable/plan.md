## Goal

Turn the featured hero slot at the top of `/blog` into an auto-advancing, pausable carousel when admins feature more than one post. With one featured post it stays exactly as today (a static hero). With none, the page stays pure reverse-chronological.

## Current state (verified)

- `adminSetPostFeaturedServer` in `src/lib/blog.server.ts` clears every other `featured` row before setting one, so only one post can be featured at a time.
- `src/routes/blog.index.tsx` picks `posts.find(p => p.featured)` and renders one `FeaturedHero`; all other posts fall into the mobile rows / desktop card grid.

## Changes

1. **Allow multiple featured posts** — remove the "unfeature everything else" step in `adminSetPostFeaturedServer` so the admin Blog table can star as many posts as they want. The public list already returns `featured` per post.

2. **Featured carousel component** (new `src/components/blog-featured-carousel.tsx`)
   - Takes the featured posts array; renders the existing `FeaturedHero` markup as slides in the same space and same dimensions.
   - Auto-advances every ~7s with a crossfade/slide transition; loops.
   - Pauses on hover, on focus within, on touch/drag, and when the tab is hidden or the user prefers reduced motion.
   - Controls: a small play/pause button plus dot indicators (tap a dot to jump). Swipe left/right on mobile.
   - Slides are links to the post, so tapping a slide still navigates.
   - Accessible: `aria-roledescription="carousel"`, labelled slides, live-region-free auto rotation with the pause control available.

3. **Wire into `src/routes/blog.index.tsx`**
   - `const featured = posts.filter(p => p.featured)`.
   - 0 featured → current chronological layout; 1 → static `FeaturedHero`; 2+ → carousel.
   - Featured posts stay excluded from the rows/grid below, as today.

## Technical notes

- No schema change; the `featured` boolean and its index already exist.
- Carousel state is local React (index + paused), no new dependency — plain Tailwind transitions plus a `setInterval` cleared on unmount.

# Logged-out homepage redesign — editorial front door

Rebuild the logged-out `/` as a Blog-led editorial publication. Signed-in `MemberHome` is untouched.

## Confirmed current state

- `src/routes/index.tsx` already splits `PublicHome` / `MemberHome` / auth skeleton — keep that split.
- `src/components/home/public-home.tsx` (609 lines) renders the 88vh globe Hero, `HomePulseRail`, `WorkStoriesCarousel`, `GalleryLoggedOutHero`, `CollabsRail`, `GalleryRail`, `FeaturedEventsCarousel`, `CityEventsStrip`, then `HomeBlogRail` last. Its Works/Collabs queries run client-side via the browser Supabase client.
- Reusable server code exists: `listPublishedPostsServer`, `featuredBlogServer`, `blogRailServer`, `listHomeWorkStoriesServer`, `FEATURED_POST_CAP = 5`.
- `TopNav` renders the Create dropdown *before* the auth branch, so logged-out desktop visitors see it.
- `MobileBrandHeader` always renders settings/inbox/notifications.
- `useMobileIslandVisibility` hides the island for logged-out `/u/*` and `/works/*` but not `/`.

## Wave 1 — Public data contract

- Add `PublicHomePayload` to `src/lib/home-types.ts`: `featuredPosts`, `featuredIsFallback`, `latestPosts`, `workStories`, `openCollabs`, `featuredGroups`, `visualWorks`.
- Add `getPublicHome` (public, GET) in `src/lib/home.functions.ts`; implementation `getPublicHomeServer` in `src/lib/home.server.ts`, running all sources concurrently.
- Reuse `featuredBlogServer` (cap 5, published + indexed + not future-dated, newest first, newest-post fallback) and `listHomeWorkStoriesServer` (limit 3).
- Move the Collabs / Groups / Works selection out of `public-home.tsx` into the server implementation, keeping the existing public filters (`status = published`, `visibility = public`, `deleted_at IS NULL`); Groups order featured-first by `featured_at`, then member count.
- Dedupe: latest stories and "More from the Blog" exclude ids already shown above.

## Wave 2 — Editorial composition

`PublicHome` becomes a thin composition over one `useServerFn(getPublicHome)` query, key `["public-home"]`, stale time ~3 min. New presentational components in `src/components/home/`:

1. Compact masthead (eyebrow / H1 "Independent culture, made together." / description) — no globe, no viewport-height section.
2. `public-featured-stories.tsx` — one story at a time, desktop image-beside-type split, arrows ≥44px, `1 / 5` indicator, restrained auto-advance with pause on hover/focus/hidden tab and `prefers-reduced-motion`.
3. `public-latest-stories.tsx` — six non-featured posts; asymmetric desktop grid, vertical list on mobile.
4. `public-open-collabs.tsx` — up to three type-led "open calls" entries, no fake covers.
5. `public-work-stories.tsx` — static two-column Work↔Blog composites from the batched query, focal points preserved.
6. `public-group-scenes.tsx` — up to three public Groups, real covers or accent fallback; no live/audio/presence signals.
7. More from the Blog — dense list of the next 4–6 unseen posts.
8. `public-work-strip.tsx` — three published public Works with covers, no filter controls.
9. Restrained final conversion (Join / Sign in).

Dimensionally accurate skeletons for the featured story and first grid; every section omits itself when its data is empty.

Stop rendering (do not delete the shared components): Hero, `HomePulseRail`, `GalleryLoggedOutHero`, `FeaturedEventsCarousel`, `CityEventsStrip`, `GalleryRail`, `CollabsRail`, `HomeBlogRail`. Remove the now-dead local helpers, imports, and state in `public-home.tsx`, including the globe/promo imports.

## Wave 3 — Anonymous chrome

- `TopNav`: move Create inside the authenticated branch; anonymous center nav = Blog, Gallery, Collabs, Groups; right side = Sign in + Join (`/signup`). Authenticated nav unchanged.
- `MobileBrandHeader`: anonymous shows wordmark + Sign in + Join only; authenticated unchanged.
- `useMobileIslandVisibility`: hide island and composer when logged out and pathname is exactly `/`; no flash while auth loads.
- Footer: ensure Groups points at `/groups`, public ordering Blog → Gallery → Collabs → Groups. Newsletter preserved.

## Wave 4 — Metadata, a11y, QA

- `src/routes/index.tsx` head: title "Workshop — Independent culture, made together", the new description, canonical + `og:url` `https://workshopindie.com/`, `og:site_name`, `og:type=website`, Twitter tags.
- One H1, semantic sections, slide-position announcement, inactive slides not focusable, alt text = `cover_image_alt ?? title`, decorative images empty alt.
- Eager first featured image, lazy + `decoding="async"` below the fold, fixed aspect ratios.
- Verify at 390 / 768 / 1280 / 1440, plus signed-in `/`, `/blog`, `/gallery`, `/collab`, `/groups`, `/lounge` redirect. Run build and lint, separating pre-existing warnings.

## Guardrails

No Lounge/live/audio/presence surface on the public homepage. No new tables, migrations, RPCs, CMS, ranking model, or dependencies. Group realtime and legacy `/lounge` compatibility untouched.

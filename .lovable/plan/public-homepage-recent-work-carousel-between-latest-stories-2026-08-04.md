# Public homepage: Recent Work carousel between Latest Stories and Open Calls

The logged-out homepage is already Blog-led, but we want to give Work slightly more presence by adding a compact horizontal carousel of recent Work cards in the gap between the Latest Stories grid and the Open Calls section (as circled in the screenshot).

## What to change

- Add `recentWorks: PublicWorkTile[]` to `PublicHomePayload` in `src/lib/home-types.ts`.
- In `src/lib/home.server.ts`, increase the `worksPromise` query limit from 8 to 16 so we can populate both the new carousel and the existing bottom strip without duplicates.
- Split the fetched works into:
  - `recentWorks`: first 8 published public Works with covers.
  - `visualWorks`: next 3 Works for the bottom `PublicWorkStrip`.
- Create `src/components/home/public-recent-work-carousel.tsx` as a small, horizontal-scroll carousel:
  - Fixed-width cards (210px mobile, 240px desktop), 16:10 aspect images.
  - Snap scrolling, lazy images, category + credit byline.
  - Section title "Recent Work", eyebrow "Made on Workshop", and a "Browse the Gallery" link.
- Insert `<PublicRecentWorkCarousel works={data.recentWorks} />` in `src/components/home/public-home.tsx` between `<PublicLatestStories />` and `<PublicOpenCollabs />`.
- The mobile tag-filter menu is intentionally deferred — categories are not defined yet.

## Verification

- Confirm the carousel renders between Latest Stories and Open Calls on the logged-out `/` route.
- Check that bottom strip still renders distinct works when 9+ public works exist.
- Run build and lint; separate any pre-existing warnings.

## Guardrails

No new dependencies, no new tables, no new migrations. Reuse the existing `PublicWorkTile` type and semantic design tokens. Keep the carousel compact so it does not dominate the Blog-led hierarchy.

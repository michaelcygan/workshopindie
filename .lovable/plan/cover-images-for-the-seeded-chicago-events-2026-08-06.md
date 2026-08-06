# Cover images for the seeded Chicago events

Each of the 8 Chicago listings gets a cover image taken from the venue's or organizer's own public page — the same page already stored as the listing's "Official event page" link.

## Where the images come from

For every listing I fetch its official page and take the image the venue itself publishes for sharing (its Open Graph / social preview image, or the primary hero photo on the page when there is no OG image). That is the picture the venue already puts forward when its page is shared anywhere on the web.

If a venue publishes no usable image, that listing stays with the current plain cover rather than borrowing a photo from somewhere else.

## Hosting and attribution

Images are copied into Workshop's existing `event-covers` storage rather than hot-linked from the venue's server, so covers don't break when the venue redesigns its site or blocks outside traffic.

Each cover carries a small credit line on the event page: "Photo: <venue name>" linking to the venue's official page. Combined with the existing "External event" chip and the organizer host line, nothing implies Workshop shot the photo or runs the night.

If a venue later asks for their photo to come down, an admin can clear the cover from the existing admin events screen and the listing falls back to the plain cover.

## What gets built

1. Fetch and review — pull each venue page, pick the best available image, and check it actually depicts the venue or event (skip logos-only, stock filler, and anything under ~600px wide).
2. Store — upload the accepted images to the `event-covers` bucket, made publicly readable for cover display, and set each listing's cover plus its photo credit.
3. Apply to the whole series — every date of a recurring listing shares its series' cover, including dates generated in the future, so the image doesn't disappear next week.
4. Verify — signed-out check of the Chicago Group, the events directory, an individual event page, and mobile, confirming covers render, credits link out, and no listing is left with a broken image.

## Technical notes

- Two small columns on the events table for the credit: photo credit name and credit URL (nullable), carried on both `group_events` and the `event_series` template so materialized future dates inherit them.
- Storage: existing `event-covers` bucket switched to public read (write stays admin-only), images normalized to roughly 1600px wide JPEG.
- The seed manifest (`src/lib/seed/chicago-events.data.ts`) gains a cover field per event so re-running the seed keeps images attached; the event page and event card read `cover_url` as they already do.
- Files touched: the seed manifest and seed function, `src/routes/g.$slug.e.$eventSlug.tsx` for the credit line, plus one migration for the credit columns.

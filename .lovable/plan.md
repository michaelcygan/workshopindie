# Cover images for the 35 new Chicago listings

The first 8 Chicago listings already carry a venue photo and a "Photo: <venue>" credit. The 35 newly seeded listings (open mics, reading series, hack nights, design talks, film and photo meetups) still show the plain category cover. This does the same pass for them.

## Where the images come from

For each listing I fetch the organizer's own official page — the same link already stored on the listing — and take the picture that organizer publishes for sharing (its social preview image, or the main hero photo when there is no share image).

Rules for accepting an image:

- It must actually depict the venue, the event, or the organizer's own artwork/poster.
- Skip bare logos on flat backgrounds, stock filler, and anything under roughly 600px wide.
- Listings at the same venue reuse one image rather than repeating a fetch.
- If an organizer publishes nothing usable, that listing keeps the plain category cover. Some — small reading series, library-hosted nights, meetup-only groups — will fall into this bucket, and that is fine.

## Hosting and attribution

Images are copied into Workshop's existing covers storage rather than hot-linked, so they don't break when a site is redesigned or blocks outside traffic. Each cover carries the same small credit line the existing 8 use: "Photo: <organizer name>", linking to their official page. With the existing "External event" chip and the organizer host line, nothing implies Workshop shot the photo or runs the night.

An admin can clear any cover from the admin events screen and the listing falls back to the plain cover.

## What gets built

1. Fetch and review — pull all 35 organizer pages, pick the best available image per listing, and record which ones have nothing usable.
2. Store — normalize the accepted images to roughly 1600px wide JPEG and upload them to the covers bucket under the Chicago events path.
3. Attach — set cover and credit on the already-seeded rows: both the recurring series templates and every dated occurrence already materialized, so the image is on this week's date and on future generated dates.
4. Keep it stable — record the same covers in the seed manifest so a future re-run of the seed keeps the images attached.
5. Verify — signed-out check of the Chicago group, the events directory, a handful of individual event pages, and mobile: covers render, credits link out, and no listing shows a broken image.

## Technical notes

- Image resolution reuses the existing hardened metadata fetcher (`src/lib/url-metadata/resolve.ts`), which already handles social-preview extraction and blocks unsafe hosts.
- Rows updated in place: `event_series.cover_url` / photo-credit columns and matching `group_events` rows for the seeded keys; no schema change needed since the credit columns already exist.
- Manifest updated: `src/lib/seed/chicago-events.data.ts` gains `cover_url`, `photo_credit_name`, `photo_credit_url` on the 35 entries that get an image.
- Expected coverage: venue-backed nights (bars, theaters, tea houses, studios) should mostly land an image; purely organizational hosts may not. I will report the final hit/miss list.

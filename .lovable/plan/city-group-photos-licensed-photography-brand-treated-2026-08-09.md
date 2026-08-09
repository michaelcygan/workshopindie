# City group photos: licensed photography, brand-treated

All 35 city groups currently have no cover image and no avatar — every city page and directory card falls back to the generic placeholder. This adds a real, properly licensed photograph to each city group, processed so the whole set looks like one Workshop system rather than 35 random stock photos.

## Source and licensing

- Photos come from Wikimedia Commons, restricted to public domain / CC0 / CC BY / CC BY-SA files.
- One photo per city, chosen for the scene rather than the postcard: street level, architecture, neighborhood texture, night signage — no tourist-bureau skyline where a better option exists.
- Every file records its source URL, author, and license so attribution can be shown and re-checked later. Nothing gets used without a recorded license.

## Brand treatment

Raw photos will not match each other. Each image gets the same processing pass so the set reads as one family:

- Desaturated to near-monochrome with a slight cool cast, matching the monochrome + Blueprint Cobalt UI.
- Fixed crop and dimensions (wide banner crop for `cover_url`, square crop for `avatar_url`), same contrast curve, same subtle grain.
- Exported as web-sized JPEG/WebP so pages stay fast.

Alternative if the near-monochrome pass feels too flat once seen: a lightly warmed natural-color pass with the same crop and contrast discipline. I'll produce two treated samples from one city first for a decision before processing all 35.

## Where it shows up

Existing surfaces already read `cover_url` and `avatar_url`, so no new UI is needed:
- City group page header
- Groups directory cards and featured rail
- Cities index and any group chips using the avatar

Attribution: a small credit line under the city group header, and the credit stored with the image record so it travels with the photo.

## Technical notes

- Store a `city_photo` manifest in `src/lib/geo/` mapping city slug to source URL, author, license, and attribution string — same pattern as the existing city launch manifest and the events seed data.
- Fetch and process images in a script under `scripts/geo/`, upload to the existing public `covers` bucket under a `city/` prefix, then update `groups.cover_url` / `groups.avatar_url` by slug. Idempotent: re-running replaces the same paths and never duplicates.
- Attribution stored in a small `group_photo_credits` table (group_id, source_url, author, license, license_url) with public read, admin write — so the credit line has a real source instead of a hardcoded string.
- Newly provisioned cities have no photo; they keep the current placeholder until a photo is added, and the manifest is the place to add it.

## Waves

1. Manifest schema + credits table + treatment pipeline; produce two sample treatments for one city.
2. Source and verify photos for all 35 cities (license checked per file).
3. Process, upload, and attach covers + avatars.
4. Attribution line in the group header; spot-check directory, city page, and mobile.

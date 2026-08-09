# Replace the social fallback image with the real Workshop mark

## Goal
Swap the current dark generic social-card fallback for a clean, white-background image that uses the actual Workshop brand mark and wordmark.

## What to change

1. Generate a new 1200x630 PNG at `public/brand/og-default.png`:
   - White background.
   - Use the real Workshop circular W/ mark from `public/brand/workshop-logo-mark.svg`.
   - Use the "Workshop" wordmark (same serif/display style as the site header) centered below or beside the mark.
   - No thin blue line, no dark gradient, no generic alternate-W mark.
2. Keep `src/lib/og-image.ts` pointing to `/brand/og-default.png`; no code change needed beyond the asset replacement.

## Verification
- Open a page with no cover image (e.g. a city page, collab, or the homepage) and inspect its `og:image` tag; confirm the URL is `https://workshopindie.com/brand/og-default.png` and the file is a real 1200x630 PNG.
- View the generated image directly to confirm white background, correct mark, and no blue line.
- Run typecheck and tests to confirm no broken references.

## Trade-offs
- Replaces the existing raster asset in place; old cached previews on Reddit/X/Facebook will refresh when re-scraped.
- The fallback is a static branded card rather than a per-page composed title card; that keeps the build simple and avoids SVG-on-social problems.

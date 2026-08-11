Constrain the logged-in homepage featured blog card

The "Latest from the Blog" / "Featured from the Blog" card in `src/components/home/home-featured-blog.tsx` currently grows too tall because the cover image fills the full slide height. The goal is to return it to a compact, standard size that doesn't dominate the page.

## Changes
- In `src/components/home/home-featured-blog.tsx`:
  - Fix the cover image to a consistent aspect ratio (e.g., 16:10) with a bounded height instead of letting it stretch to match text height.
  - Cap the overall slide height so the card stays compact regardless of excerpt length.
  - Slightly reduce title, excerpt, padding, and control-button sizes so the module feels like a header teaser rather than a hero.
  - Preserve the carousel behavior, auto-advance, reduced-motion support, and accessibility attributes.

## Verification
- Build the project and confirm no errors.
- Check the preview at desktop and mobile widths to ensure the card stays at a consistent, smaller size.

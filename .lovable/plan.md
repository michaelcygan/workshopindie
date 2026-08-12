# Blog composer: image upload pass + lite Gallery block

## Part 1 — Image upload flow check

Current behaviour (verified in the composer): one file at a time, 10MB cap, non-GIF images downscaled to 2048px JPEG, uploaded to the public `covers` bucket, then alt / caption / credit / link fields, rendered as a centered figure that joins the post lightbox unless a link is set.

Gaps worth fixing in the same pass:

- The file input accepts any file type (validation only fires after selection). Add `accept="image/*"` so the OS picker filters correctly.
- No drag-and-drop and no paste-from-clipboard into the dialog — both are one-liners on the drop zone.
- No visible progress or thumbnail while uploading; the dialog just sits there. Add a spinner state plus a preview of the uploaded image with a "Replace" action.
- Pasting a non-image URL silently produces a broken figure. Add an `onError` fallback in the dialog preview so the author sees the image didn't load before inserting.

## Part 2 — Lite Gallery block

A new body block that holds 2–12 images and renders in one of two modes, chosen by the author:

- **Wall** — a responsive CSS grid mosaic. Two columns on mobile, three on desktop; the first image spans two columns when the count makes the row uneven, so it stays visually composed without any layout library.
- **Slideshow** — a horizontal scroll-snap strip with arrow buttons and dot indicators. Pure CSS scroll snapping plus a couple of `scrollBy` calls; no carousel dependency.

Both modes are click-to-open in the existing blog lightbox, which already supports next/prev — so the slideshow experience is available from either layout. Optional caption under the whole gallery.

Zero new dependencies, all images lazy-loaded.

### Authoring

A new Gallery button in the sticky toolbar opens a dialog where the author can:
- upload multiple photos at once (same resize/upload pipeline as single images) or paste URLs
- reorder by drag or with left/right move buttons, and remove individual photos
- set per-photo alt text, and one caption for the gallery
- toggle Wall vs Slideshow

In the editor the gallery renders exactly as it will publish, with the same edit / remove controls the image and embed blocks already have.

## Technical notes

- `src/lib/blog-body-segments.ts`: add a `gallery` segment plus a `[[gallery:url1|url2|...|layout=wall|caption=…]]` marker with the same encode/decode helpers used by `[[image:…]]`. Per-photo alt travels alongside each URL.
- `src/components/blog-gallery.tsx` (new): shared renderer for both layouts, with an `inert` mode for the composer, mirroring `blog-figure.tsx`.
- `src/components/blog-post-body.tsx`: render the new segment and fold gallery photos into the lightbox image set.
- `src/components/blog-body-editor.tsx`: toolbar button, multi-file upload handler, gallery dialog, composer block.
- `src/lib/blog-excerpt.ts`: strip `[[gallery:…]]` markers (and confirm `[[image:…]]` is stripped) so markers never leak into summaries or meta descriptions.
- Uploads keep using the existing public `covers` bucket and current auth path.

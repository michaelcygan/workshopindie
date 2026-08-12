# Inline images in the blog composer

Add a proper image block to the blog composer: upload a photo (or paste a URL), and it renders as a centered, site-styled figure in both the editor and the published post — with optional caption, credit, alt text, and a click-through link.

## What you'll get

**Toolbar**: a new Image button in the sticky tool stripe (next to the embed/film button).

**Insert dialog** with two ways in:
- Upload from device (JPG, PNG, WebP, GIF, up to ~10MB)
- Paste an image URL

Plus optional metadata fields:
- Alt text (accessibility + SEO)
- Caption (shown under the image)
- Credit / photographer (shown next to the caption, smaller)
- Link URL — when set, clicking the image opens that link instead of the lightbox

**In the editor**: the image renders as the real figure card (not raw markdown text), with Edit and Remove controls, exactly like the existing embed cards behave today.

**On the published post**: a centered figure, constrained to the article measure, rounded corners, lazy-loaded, caption/credit underneath in the site's muted editorial style. No link = opens in the existing lightbox. Link set = the image becomes a link (external links open in a new tab; internal Workshop links route in-app).

## Defaults

- One width treatment: centered, full article measure — no half/left/right variants, keeping it basic as asked.
- Uploads go to the existing public `covers` bucket under a per-user folder, same as blog cover images.
- Images without alt text still publish; the field is encouraged, not required.

## Technical notes

- New body marker parsed alongside the existing `[[embed:URL]]` line format, e.g. a full-line `[[image:...]]` marker carrying the URL plus optional `alt`, `caption`, `credit`, and `link` fields. Extend `src/lib/blog-body-segments.ts` with an `image` segment type plus parse/serialize support, so composer and public renderer stay in sync (both already build off these helpers).
- `src/components/blog-post-body.tsx`: render the new `image` segment via a shared `BlogFigure` component; keep existing inline `![alt](url)` markdown images working and included in the lightbox set.
- `src/components/blog-body-editor.tsx`: add the toolbar button, an insert/edit dialog reusing the existing dialog pattern used for embeds, and figure rendering with edit/remove affordances at the caret position.
- Upload path reuses `uploadToBucket` in `src/lib/storage.ts` (`covers` bucket, `${userId}/${uuid}.${ext}`), with client-side type/size validation.
- Excerpt generation (`src/lib/blog-excerpt.ts`) strips the new marker the same way it strips `[[embed:...]]`.

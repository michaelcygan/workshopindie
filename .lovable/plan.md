# Complete the Work publishing system

Expose the existing universal asset layer during Work creation, and give Works a media-capable "About this Work" body — without a new primitive, taxonomy change, or Work page restructure.

## What the audit confirmed

- `work_assets` exists with nine asset types, size/extension allowlists, upload helpers, reorder/primary logic, and the `resolveWorkAssets` legacy adapter (`src/lib/work-assets.ts`). Assets upload into the public `work-covers` bucket under `{userId}/assets/{workId}/…`.
- `WorkAssetsEditor` is workId-bound: it uploads and inserts rows immediately, so it can't run in the creation composer as-is.
- `works.new.tsx` publishes straight to `status: "published"` in a single insert, then inserts credits, then tags groups. Description is a `Textarea` capped at 3,000; server validation in `works.functions.ts` caps at 4,000.
- `works.$slug.edit.tsx` renders `WorkAssetsEditor` only when the Format is not a book, hides the primary/embed link inputs for books, and uses a plain `Textarea` for description.
- `works.$slug.tsx` renders `WorkViewer` for the presentation and the description via `whitespace-pre-wrap`; meta description, `useDocumentMeta`, and JSON-LD all fall back to raw `work.description`.
- `BlogBodyEditor` (1,307 lines) already implements the four-segment format (text / embed / image / gallery) over `src/lib/blog-body-segments.ts`, with upload + resize, mirror-div height stability, and dialogs. It is hardcoded to the `covers` bucket, blog heights, and word count.
- `BlogPostBody` renders those segments with a shared lightbox set, safe Markdown (no raw HTML), and entity link previews.

## Plan

### 1. Shared authoring core
Generalize the existing editor into a configurable `RichBodyEditor` (label, placeholder, min height, enabled tools, upload bucket + path, helper copy, word-count on/off, entity-insert hook). `BlogBodyEditor` becomes a thin wrapper passing today's exact configuration, so all Blog behavior is byte-for-byte unchanged. Same treatment for the renderer: a shared `RichBody` with `BlogPostBody` kept as a compatibility wrapper.

Work configuration: shorter min height, uploads to `work-covers` under the authenticated user's path, same non-GIF resize pipeline, no word count, toolbar = Bold, Italic, Link, Photo, Gallery, Embed + a More menu (H2, H3, Quote, bullet list, numbered list, divider).

### 2. Work media in the composer
New `WorkMediaComposer` — a staging version of the asset editor that holds items in React state instead of writing to the database. Placed in `works.new.tsx` after Field / Specialization / Format (and format-specific fields), before the ownership checkbox, titled **Work media** with the helper "Add the files and links that make up this Work. The first item leads the page."

Four compact actions: Photo / gallery (multi-select images), Video / audio (external URL only), Reader / file (PDF + already-approved types), Link (repo, demo, dataset, Figma, site). Types inferred through the existing `validateUpload` / `inferAssetTypeFromUrl`. Items reorder, remove, caption, alt-text; first item badged "Leads the page"; existing download toggle and license default preserved. No assets → current cover fallback stays.

`WorkAssetsEditor` is refactored to share the same row UI so create and edit look identical.

### 3. Staged publish pipeline
`publish()` becomes: insert Work as `draft` → upload staged files and insert `work_assets` rows → insert creator/co-creator credits → only then update to `published`. Group tagging stays best-effort after publish. On failure the Work stays draft, the composer keeps its state, and a specific retry error is shown; a storage upload whose row insert fails has its file removed. "Add another" clears staged media and revokes object URLs.

### 4. URL handling
Media URLs run through the existing `extractWorkFromUrl` / URL-metadata resolver so a YouTube or Vimeo watch page is stored as its embed-ready URL, with the original kept in asset `metadata`. Legacy `embed_url` / `primary_url` / `cover_url` continue to flow through `resolveWorkAssets`; no bulk migration.

### 5. Public Work page
Order unchanged. Description renders through the shared rich renderer instead of `whitespace-pre-wrap` (plain legacy text still renders as ordinary paragraphs). Supporting images render as a gallery even when the lead asset is video, audio, PDF, or a repository. BookHero stays, but books are no longer excluded from assets — a book can carry a sample PDF, trailer, or photographs below the hero. Book detection reads `subtype`/Format, not only the legacy `writing_book` category.

### 6. SEO and limits
Reuse `markdownToPlainText` from `src/lib/blog-excerpt.ts` for meta description fallbacks, `useDocumentMeta`, JSON-LD, and any Work summary that falls back from excerpt to description, so markers never leak. The author excerpt stays the preferred summary. One shared body limit of 25,000 characters across create, edit, and `works.functions.ts` validation.

### 7. Edit parity
`works.$slug.edit.tsx` gets the same Work media editor and About this Work editor, for books too. Legacy embed/primary links remain visible and editable rather than silently hidden. Licensing, Book details, cover editing, and Save behavior unchanged.

## Verification

Painting (cover + six reordered, captioned images → one gallery), short film (embed leads, stills gallery, no raw watch URL in an iframe), play/paper (PDF reader on mobile and desktop with context below), music (audio embed leads), book (BookHero + optional sample PDF), an existing legacy Work rendering unchanged, failure paths leaving no half-published Work, and a full Blog regression pass (create, edit, preview, images, galleries, embeds, entity links, published rendering).

## Out of scope

New primitives, medium-specific tables, native video/audio hosting, a block-editor framework, nested layouts, asset-level social features, PDF annotation, raw HTML or arbitrary iframes, taxonomy changes, gallery card redesign.

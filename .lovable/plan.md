# Work as a Universal Publishing Primitive

Make the existing Work primitive able to carry many presentation assets — images, PDFs, embeds, files, repositories, 3D models — without adding new Workshop entities and without rewriting the Work system.

## What the audit found

Verified by reading the schema, routes and storage config:

- `works` already has `category`, `categories`, `subtype`, `description`, `excerpt`, `cover_url`, `primary_url`, `embed_url`, `license_type`, `commercial_use`, the book fields, cover framing (`cover_aspect`, `cover_focal_x/y`) and canonical category mirrors. No Work-column changes are needed for this pass except one optional field.
- The Work detail page (`src/routes/works.$slug.tsx`, 594 lines) renders exactly one primary visual: BookHero, else `embed_url` via `EmbedPlayer`, else `cover_url` as a single `<img>`. That single branch is the whole gap.
- Storage already has a public `work-covers` bucket (owner-scoped writes via `{user_id}/…`) and a **private** `work-files` bucket scoped `{work_id}/…` with member-only read, used by Workshop-room archives. Public Work assets cannot reuse `work-files` as-is — its read policy is members-only.
- URL extraction (`src/lib/url-metadata/resolve.ts`) already detects GitHub and fetches repo name, description, language and an OG image; YouTube/Vimeo/SoundCloud/Bandcamp embed resolution exists with an allowlist (`ALLOWED_EMBED_HOSTS`). Repository presentation can be built on this — no new fetching layer.
- `embla-carousel-react` is already a dependency (`src/components/ui/carousel.tsx`), so the image gallery and PDF pager need no new carousel library.
- `subtype` is a free-text column driven by `WORK_SUBTYPES` in `src/lib/categories.ts`, keyed by the six stored work categories. Format can be layered on this non-destructively.
- Work RLS: public read of published works; creator-only insert/update/delete; `is_work_member()` exists as a SECURITY DEFINER helper and can gate asset writes.

Conclusion: the architecture is additive. One new table, one public bucket, one viewer layer, small creation-flow additions.

## Waves

### Wave 1 — Asset foundation (schema + data layer)
New table `public.work_assets`, following Workshop conventions:

```
id, work_id, created_by, asset_type, url, storage_path, label, caption,
mime_type, byte_size, sort_order, is_primary, download_enabled, metadata, created_at, updated_at
```

- `asset_type`: `image | document | video | audio | repository | file | dataset | model_3d | external` (a small check-constrained text set, not a discipline enum).
- Grants for `anon` (select) + `authenticated`/`service_role`; RLS: public read when the parent Work is published/public, write restricted to `is_work_member(work_id, auth.uid())`.
- One primary per Work enforced by a partial unique index; `sort_order` drives presentation.
- New public storage bucket `work-assets`, path `{work_id}/{asset_id}.{ext}`, writes gated by work membership, public read. Server-side MIME/extension allowlist and per-type size caps (proposed: images 8 MB after client downscale, PDF 25 MB, dataset/file 25 MB, GLB 15 MB, STL 25 MB) — anything larger is redirected to "host it externally and add the link".
- Typed read/write server functions (`src/lib/work-assets.*`), plus a normalizer that derives virtual assets from legacy `embed_url` / `primary_url` so every existing Work renders unchanged.

### Wave 2 — WorkViewer shell + backward compatibility
`<WorkViewer work={work} assets={assets} />` replaces the inline conditional block on the Work page. It picks the primary asset, falls back to the legacy embed/cover branch, and renders supporting assets below. BookHero, cover-as-OG, gallery cards and SEO stay exactly as they are.

### Wave 3 — ImageViewer
Embla-based gallery: single large image, count indicator, prev/next, keyboard arrows on desktop, natural swipe on mobile, tap-to-fullscreen, optional captions, lazy loading of non-adjacent images. Covers painting, photography, ceramics, sculpture, architecture, textiles.

### Wave 4 — DocumentViewer (launch-critical)
Lazy-imported PDF.js reader: one page rendered at a time, adjacent page prefetch, page counter, desktop arrows + keyboard, mobile horizontal swipe, fullscreen, download button gated on `download_enabled`. Hard fallback to "Open PDF / Download PDF" if the renderer fails — a PDF error never breaks the page. Acceptance case: an 80-page play read end to end on mobile and desktop.

### Wave 5 — File, dataset and repository cards
`FileViewer` (filename, type, size, download/open) covers CSV, JSON, GeoJSON, ZIP, STL and misc approved files. `RepositoryViewer` renders the already-extracted GitHub metadata (owner/name, description, language, sanitized README excerpt, "View repository") with no iframes and no script execution.

### Wave 6 — ModelViewer (GLB/glTF)
Poster-first: cover image plus a "View 3D model" button; the viewer module and the model load only on click. Touch rotate that does not hijack page scroll, desktop drag, download fallback. STL stays a downloadable file asset — no server conversion. Never rendered in gallery cards.

### Wave 7 — Creation and edit flow
Preserve "paste a link or start from scratch" and the collapsed "Add details" pattern. Add an upload path that accepts images / PDF / file / 3D and infers asset type and a suggested Field + Format from what was dropped (always correctable). Supporting assets can be added, reordered (simple drag with up/down fallback) and removed from the Work edit page after publishing.

### Wave 8 — Format layer
Evolve `subtype` into the user-facing **Format** concept in TypeScript only — no column rename, no data migration. Expand the per-Field format suggestions (Play, Screenplay, Research Paper, Dataset, 3D Print, Hardware, Application, Benchmark, Map, Ceramics, …), filtered by selected Fields with a custom fallback. Display as `Field · Format` on the Work page and gallery cards.

### Wave 9 — Rights and downloads
Per-asset `download_enabled`, defaulting from the Work's license: CC-licensed → downloadable, credit-only/rights-managed → view-only unless the creator opts in. The UI states creator intent plainly and makes no DRM claim.

### Wave 10 — Reference fixtures + regression
Build the six reference Works (painting, play, short film, software, research, 3D print) as fixtures and verify them end to end, then regression-test legacy Works, gallery, profiles, group Work tabs, blog context, source collabs, sharing/OG, mobile gestures, asset deletion, work deletion with storage cleanup, and failed uploads.

## Explicitly out of scope

New Workshop primitives, asset-level social features or URLs, PDF annotation, spreadsheet or notebook tooling, code execution, GitHub cloning, arbitrary iframes, video/audio hosting or transcoding, STL→GLB conversion, an equation editor, and any destructive category migration.

## Technical notes

- Canonical URL stays `/works/{slug}`; assets get no public routes. Schema.org output is unchanged in this pass.
- Blog context, Collab provenance, Group tagging, credits, comments and engagement all remain Work-level and untouched.
- PDF.js and the 3D viewer are dynamically imported so image/video Works pay none of that bundle cost.
- Legacy Works are never bulk-migrated; the adapter keeps `embed_url`/`primary_url`/`cover_url` authoritative until a creator adds real assets.


# Post-a-Work — v1 distillation

Four focused changes to `/works/new`, the extractor, and the work renderer. One migration, no new tables.

## 1. Cover framing chooser (1:1 / 16:9 / 4:5)

YouTube/Vimeo thumbnails come back 16:9 and the card forces a 4:5 frame — clipping the top and bottom. Let the user pick the framing.

- Migration: add `works.cover_aspect text default 'portrait'` (check `('portrait','square','landscape')`) and `works.cover_focal text default 'center'` (`'top'|'center'|'bottom'`).
- In `/works/new`, when a `cover_url` is present, show three framing tiles (1:1, 16:9, 4:5) plus a focal selector — all rendered from the same source URL using `aspect-*` + `object-cover` + `object-position`. No re-upload, no server crop.
- `WorkCard` honors `cover_aspect` in default density (hero stays 16:10). Gallery masonry tolerates mixed heights.

## 2. Drop user video uploads

Cloudflare Stream bandwidth blows up at HD; v1 stays embed-only.

- Remove `VideoUploadButton` from `DropStep` (and the "Or upload a video file" link).
- Leave `stream-uploads.functions.ts` and `media_assets` wiring intact — archived Workshop recordings still use them — but stop exposing the entry point from the Work flow.
- Reword the drop card: "Paste a link from YouTube, Vimeo, SoundCloud, Bandcamp, or your own site."

## 3. Image-upload guardrails

`ImageUpload` is the only image surface on a Work (cover only — no gallery in v1). Cap what lands in storage:

- Client: reject >3 MB or >4096 px long-edge; auto-downscale via existing `image-resize.ts` (raise `maxEdge` to 2048 for covers).
- Add a `tg_works_cover_cleanup` trigger: when `cover_url` changes on a `works` row and the previous URL points to the `work-covers` bucket, delete the old storage object (via `storage.delete_object`) so replacements don't accumulate.
- No multi-image gallery — description stays text-only.

## 4. Build category — URL-only with smart cards

Build gets a dedicated branch in `extractWorkFromUrl` instead of generic oEmbed:

- Migration: add `works.build_meta jsonb` (single bag — avoids schema sprawl).
- **GitHub / GitLab**: detect host, hit the public REST API (`https://api.github.com/repos/{owner}/{repo}`, no auth — unauthenticated rate limit is fine for v1 publish volume), store `{ kind: 'repo', owner, name, stars, language, description, default_branch }`. Cover falls back to GitHub's auto-generated OG image (`https://opengraph.githubassets.com/1/{owner}/{repo}`). Work page renders a repo card (icon, language dot, star count, "View on GitHub" button) — no iframe.
- **Any other site**: call Firecrawl `scrape` with `formats: ['screenshot']` from the server function once at publish time, upload the PNG into `work-covers`, set as `cover_url`. No live mirror, no scheduled refresh — user can click "Refresh preview" on the Work page (rate-limited to once per 24h per user via existing `rate_limits` table). Stores `{ kind: 'site', host, last_snapshot_at }` in `build_meta`.
- Build category never embeds an iframe. Primary CTA on the Work page is "Visit site" / "View on GitHub".
- Requires the existing Firecrawl connection (`FIRECRAWL_API_KEY`) — I'll verify it's linked before implementing; if not, I'll prompt to link it.

## Technical details

Files touched:

- `src/routes/works.new.tsx` — remove `VideoUploadButton`, add framing chooser, branch Build category UI.
- `src/components/work-card.tsx` — honor `cover_aspect` / `cover_focal`.
- `src/lib/works-import.functions.ts` — Build branch: GitHub REST + Firecrawl screenshot path.
- `src/lib/image-resize.ts` + `src/components/image-upload.tsx` — enforce 3 MB / 2048 px caps.
- `src/routes/works.$slug.tsx` — render repo card / "Visit site" CTA for Build; render cover at chosen aspect.
- Migration: `cover_aspect`, `cover_focal`, `build_meta`, cover-cleanup trigger.

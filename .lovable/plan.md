## Goal
Make publishing a Work fast and elegant for the 90% case — paste a link, confirm, publish — while keeping advanced fields one click away. Fix the cover-image letterbox issue, replace the confusing License with a simple ownership self-cert, and add optional co-creator credits and category subtypes.

## The new flow (v1)

```
Paste a link (or upload image / video / file)
        │
        ▼
We auto-fill: cover, title, category guess, embed
        │
        ▼
Confirm card (one screen)
 ─ Cover (cropped, square, no letterbox)
 ─ Title
 ─ Category + optional subtype chip
 ─ [☑] This is my work (or I have rights to share it)   ← required
 ─ ▾ Add details (collapsed)
       • One-line excerpt
       • Description
       • Co-creators (tag users or type a name)
       • Source URL (prefilled)
       • Groups
        │
        ▼
   Publish Work
```

Everything inside "Add details" is optional. Title + category + ownership check are the only required fields. Source URL stays prefilled from the paste, hidden under details.

## What changes

### 1. Cover image — fix the YouTube letterbox
- For YouTube thumbnails (and any source we know is 16:9), auto-crop to a centered square / 4:5 before showing as cover.
- Prefer YouTube's `maxresdefault.jpg` (1280×720) cropped to 4:5 around the center, instead of `hqdefault` (which has the black bars baked in).
- Add an "Adjust crop" affordance on the cover preview — simple drag-to-reposition on a square canvas, save the cropped result to the `work-covers` bucket. (Use existing `ImageUpload` + a small crop overlay; no new library needed — CSS object-position + a "Use this frame" button is enough for v1.)
- If the source is a video the user uploaded via Cloudflare Stream, allow "Pick frame from video" later (out of scope for v1, leave a stub).

### 2. Ownership instead of License
- Remove the License dropdown from the v1 flow.
- Replace with a required checkbox: **"I made this, or I have the rights to share it."** Single line, plain language.
- Keep `license_type` in the DB; default new manual works to `portfolio_credit_only`. Editable later in a future "Advanced" panel on the Work edit page.
- Footnote (small, muted): "You can change rights and add a downloadable version later." Sets us up for public-domain / downloads tab in the future without putting it in front of the user now.

### 3. Co-creators (optional)
- New collapsed section "Co-creators" under Add details.
- Combobox that searches `profiles` by display_name / username (reuse the pattern from `GroupPicker` / collab invites).
- If no match, allow "Add as plain name" — stores a free-text credit (no user_id), shown as a non-clickable chip.
- On publish, insert rows into `work_credits`:
  - Creator (current user, sort_order 0, role_label "Creator")
  - Each tagged user (sort_order n, role_label "Co-creator", user_id set)
  - Each plain-name credit (sort_order n, role_label "Co-creator", user_id null, display_name stored in a new column — see schema note).
- Replace the "Co-creator credits open up when you publish through a Workshop" disclaimer with: "You'll be credited as **Name**. Add co-creators below if you made this with others."

### 4. Category subtypes (optional)
- Add a lightweight subtype chip row that appears once a category is picked. Subtypes per category (v1 set):
  - Film: Short film, Music video, Trailer, Doc, Animation, Reel
  - Music: Single, EP/Album, Live set, Remix, Beat, Demo
  - Writing: Essay, Poem, Short story, Screenplay, Newsletter, Article
  - Build: App, Site, Tool, Plugin, Hardware, Game
  - Visual: Photo, Illustration, Design, Painting, Collage, 3D
- Subtype is optional, single-select, free-text "Other" allowed. Stored as a string on `works.subtype`.
- These power better filtering and richer profile portfolios down the road.

### 5. Required vs optional (final list)
Required: Title, Category, Ownership checkbox, Cover (auto-filled is fine).
Optional, collapsed under "Add details ▾": Subtype, Excerpt, Description, Co-creators, Source URL, Groups.
Removed from v1: License dropdown (kept in DB, edit later).

### 6. Visual polish
- Single confirm screen instead of the long scrolling form. Sticky publish bar stays.
- "Add details" disclosure uses a thin chevron row, not a full card — keeps the page short for the quick path.
- Cover preview becomes a true 4:5 frame with `object-cover` and a "Replace" + "Adjust" pair of small buttons.
- Loosen the "Drop a link" step's helper copy: "Paste a link, upload a file, or start from scratch."
- Mobile: same single-screen layout, sticky bar already handles small screens.

## Files to touch

- `src/routes/works.new.tsx` — restructure the form: required block + collapsed details, swap License for ownership checkbox, add co-creator picker, add subtype chips, prefill flow stays the same.
- `src/lib/works-import.functions.ts` — switch YouTube thumb URL to `maxresdefault` with fallback, return `cover_aspect: "16:9"` so the client knows to crop.
- New `src/components/cover-cropper.tsx` — small client component: shows the cover inside a 4:5 frame, drag to reposition, "Use this frame" uploads the cropped JPEG to `work-covers` and returns the new URL. Reuses `supabase.storage` directly.
- New `src/components/cocreator-picker.tsx` — combobox over `profiles` with "Add name" fallback. Returns `{ user_id?: string; display_name: string }[]`.
- `src/lib/categories.ts` — add `WORK_SUBTYPES: Record<WorkCategory, string[]>`.

## Schema (one migration)

```sql
ALTER TABLE public.works
  ADD COLUMN IF NOT EXISTS subtype text,
  ADD COLUMN IF NOT EXISTS ownership_certified_at timestamptz;

ALTER TABLE public.work_credits
  ADD COLUMN IF NOT EXISTS display_name text;  -- for plain-name co-creators (user_id null)

-- existing GRANTs / RLS unchanged
```

Defaults: `subtype` null, `ownership_certified_at` set on publish when the checkbox is true.

## Out of scope (intentional, for later)
- Editable advanced panel (license picker, downloadable file, visibility) on the Work edit page.
- Frame-picker from uploaded videos.
- Public-domain / downloads tab.
- Co-creator approval workflow (tagged users get notified but credit is shown immediately in v1).

## Technical notes
- YouTube `maxresdefault` 404s for some videos — fall back to `hqdefault` and crop the top/bottom 12% before showing (that's exactly the letterbox band).
- Subtype is a free string column, not an enum, so adding new subtypes later doesn't need a migration.
- Co-creator plain-name rows have `user_id` null; existing reads of `work_credits.profiles` need a coalesce to `display_name` — update `listFollowingWorks` and any other readers in the same pass.

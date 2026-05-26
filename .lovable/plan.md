# Polish `/me/edit`

Bring the edit form up to the same caliber as the new public profile. Same fields, better structure — easier to scan, easier to fill out, and surfaces the new profile primitives (mediums, pinned works) clearly.

## Structure

Convert the single long form into a sectioned page with a sticky left sub-nav on desktop (collapsing to a horizontal scrollable pill row on mobile). Sections:

1. **Identity** — avatar, cover, display name, username, first/last name, Instagram
2. **Mediums & headline** — categories (relabelled "Mediums"), headline, bio
3. **Location** — city
4. **Links** — external links
5. **Pinned works** — picker (new)
6. **Privacy** — placeholder slot for future toggles (visibility of credits, etc.); ship empty-state copy now

Each section gets a short helper sentence so multimedia artists understand why it matters (e.g. mediums → "Drives your Works tabs and which Instant Workshops you see").

## Pinned works picker

New section that lets the user pick up to 6 of their own published works to feature at the top of their public profile.

- Fetch the user's published works (`created_by = me`, `status = 'published'`) ordered by `published_at desc`.
- Render as a grid of selectable cover thumbnails with title + medium chip.
- Selected = ordered list with up/down reorder and remove; cap at 6.
- Persist to `profiles.pinned_work_ids uuid[]` (new column, default `'{}'`).
- Public profile reads this array and renders pinned works first on the Works tab (and only on the "All" filter; medium filters keep their own ordering).

## Sticky sub-nav

- Desktop (`md:` and up): two-column layout, left column ~14rem sticky nav, right column form.
- Mobile: horizontal scroll pill row pinned below the page heading.
- Active section tracked via `IntersectionObserver` on section headings.
- Clicking a nav item smooth-scrolls to that section.

## Save UX

- Sticky footer save bar appears once the form is dirty (replaces the bottom-right Save button).
- Shows "Unsaved changes" + Cancel / Save profile.
- Disabled state while saving; toast on success (existing pattern).

## Technical notes

- **DB**: one migration adding `profiles.pinned_work_ids uuid[] not null default '{}'`. No RLS change needed — covered by existing `profiles` update policy. Skip a CHECK constraint (immutable rule); validate length ≤ 6 client-side and in a lightweight trigger if we want hard enforcement (defer trigger to a follow-up — client cap is fine for v1).
- **Types**: `src/integrations/supabase/types.ts` regenerates automatically after the migration.
- **Files**:
  - edit `src/routes/me.edit.tsx` — refactor into sectioned layout, add sticky sub-nav, sticky save bar, dirty-state tracking
  - new `src/components/pinned-works-picker.tsx` — grid picker + ordered selection UI
  - edit `src/routes/u.$username.tsx` — read `pinned_work_ids`, render pinned works first on Works tab "All" filter
  - new migration for `pinned_work_ids` column
- No changes to `me.index.tsx`, auth, or other routes.

## Out of scope

- Section reordering by the user
- Per-section visibility toggles (Privacy section ships as a "coming soon" stub)
- Drag-and-drop reorder for pinned works (use up/down buttons; DnD is a follow-up)
- Editing pinned works from the public profile

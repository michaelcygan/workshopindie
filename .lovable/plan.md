## Plan: Edit a Work from its own page

Right now there's no way to edit a Work from `/works/:slug`. The create flow lives in `src/routes/works.new.tsx` but has no edit counterpart. This adds an owner-only edit affordance.

### 1. Owner-only "Edit" button on the Work page
In `src/routes/works.$slug.tsx`, in the meta strip action row (next to Pin / Like / Share / Report, ~line 246-259), render an **Edit** button only when the viewer is the creator (`user?.id === work.created_by`) or has a credit on the work. Uses the existing icon-button style (pencil icon, ghost variant, rounded-full) so it sits naturally in the row.

Clicking navigates to `/works/$slug/edit`.

### 2. New route `src/routes/works.$slug.edit.tsx`
An authenticated edit form that reuses the same fields as `works.new.tsx`:
- Title, excerpt, description
- Category + extra categories + subtype
- Cover image (via `CoverFramer` / `ImageUpload`)
- Primary URL / embed URL
- License type
- Book details (when `category === "writing_book"`)
- Co-creators / credits (via `CoCreatorPicker`)

Loads current values from Supabase on mount, pre-fills the form, and on submit runs an `UPDATE` on `public.works` scoped to the current row. On success, navigates back to `/works/$slug` and invalidates the query.

Guards:
- Redirect to `/works/$slug` if the viewer is not the creator (defense in depth — RLS is the real gate).
- Shows "Work not found" if the slug doesn't resolve.

### 3. Refactor shared form (light touch)
To avoid duplicating ~500 lines from `works.new.tsx`, extract the form body into a new `src/components/work-form.tsx` that accepts:
- `mode: "create" | "edit"`
- `initialValues` (optional)
- `onSubmit(values)` callback

`works.new.tsx` and the new edit route both render `<WorkForm />`. Import-driven URL extraction and group tagging stay in the create route only — edit mode hides those sections.

### 4. RLS check
Confirm `public.works` has an UPDATE policy for `created_by = auth.uid()`. If missing, add a migration:
```sql
CREATE POLICY "Owners can update their works"
ON public.works FOR UPDATE TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());
```
(Only added if the policy doesn't already exist.)

### Out of scope
- No delete flow (can be a follow-up).
- No version history / draft revisions.
- No changes to credits invitation flow beyond what `CoCreatorPicker` already supports.
- No changes to the create route's URL-import step.

### Files touched
- **Edit:** `src/routes/works.$slug.tsx` (add Edit button)
- **Create:** `src/routes/works.$slug.edit.tsx` (new edit route)
- **Create:** `src/components/work-form.tsx` (shared form extracted from `works.new.tsx`)
- **Edit:** `src/routes/works.new.tsx` (use `<WorkForm mode="create" />`)
- **Maybe create:** migration for UPDATE policy on `public.works`

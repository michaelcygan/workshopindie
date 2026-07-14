## Link profile cover to source Work

When a profile's cover was picked from one of the user's own Works, clicking the cover should navigate to that Work's page. Uploaded covers remain non-clickable.

### Data

- Add `profiles.cover_work_id uuid null references public.works(id) on delete set null`, indexed.
- No new RLS needed — column follows existing profiles policies. Migration only.

### Write path — `CoverImagePicker`

- Add optional `onWorkChange?: (workId: string | null) => void` prop.
- "Select from a Work" → call `onChange(cover_url)` AND `onWorkChange(workId)`.
- "Upload image" → `onWorkChange(null)` after upload.
- "Remove cover" → `onWorkChange(null)`.
- `me.edit.tsx`: track `coverWorkId` in form state, load it from profile, persist `cover_work_id` in the upsert alongside `cover_url`.

### Read path — `u.$username.tsx`

- Include `cover_work_id` + joined `cover_work:works!profiles_cover_work_id_fkey(slug, status, visibility)` in the profile select.
- Cover render (line 431): if `cover_work` exists and is `published` + visible to viewer, wrap the `<img>` in a `<Link to="/works/$slug">` with `params.slug = cover_work.slug`; add subtle `cursor-pointer` and an "Open Work" pill in the bottom-right corner (only when linkable) so the affordance is discoverable. Otherwise render as today.
- Owner's edit controls stay on top of the link with `relative z-10` + `stopPropagation`.

### Out of scope

- No auto-detection for legacy covers whose URL happens to match a work cover — only newly picked covers get linked. Users re-pick to link older banners.
- No banner-from-others'-works (own works only, matching current picker behavior).
- No changes to `WorkCard`, gallery, or other cover surfaces.

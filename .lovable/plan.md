# In-person Collabs → city-scoped Workshops + simple rights field

## 1. City-scoped Workshops for in-person Collabs

When a Collab is in-person and tied to a city, the Workshop spawned from it should only surface to people in that city (host always sees it).

**Schema (one migration):**
- Add `audience_city_ids uuid[] not null default '{}'` to `workshops`.
- Empty array = public to everyone (today's behavior).
- Non-empty array = only visible in listings to viewers whose `profiles.home_city_id` is in the array, or who are the host.

**Populate it at creation time:**
- `src/lib/collab-workshop.functions.ts` (`openWorkshopOnCollab`): read the source Collab's `location_mode`, `city_id`, `also_cities`. If `location_mode === 'in_person'` and `city_id` is set, set the new workshop's `audience_city_ids = [city_id, ...also_cities]` and `location_type = 'in_person'`, `city_id = post.city_id`. Hybrid stays public (it's hybrid).
- `src/routes/collab.new.tsx` (scheduled-workshop branch): same logic on the inline `workshops.insert(...)`.

**Filter in listings:**
- `src/routes/workshops.index.tsx`: include `audience_city_ids,host_user_id` in the select. After fetch, in the same JS filter chain as the age filter, drop rows where `audience_city_ids.length > 0` AND viewer's `home_city_id` is not in it AND viewer is not the host. Anonymous viewers see only unrestricted workshops.
- Fetch the viewer's `home_city_id` once via a small query alongside `getMyAgeFields` (or extend that server fn — see Technical notes).
- `src/components/workshop-card.tsx`: when `audience_city_ids.length > 0`, render a small "City-only" chip near the existing location pill so it's obvious to host/admins why visibility is narrower. No new layout.

**Out of scope:** hiding the workshop *detail* page from non-locals (deep-linked URL still works). This is a listing/discovery scope change, not access control. We can lock the detail page later if abuse appears.

## 2. Owner-only Workshop creation + leadership (verification only)

Already enforced — no code change. The server fn `openWorkshopOnCollab` rejects any caller that isn't `post.user_id` and sets `host_user_id = userId`. The collab detail UI hides the "Open a Workshop on this" button behind `isOwner`. I'll add a one-line code comment near both spots so this guarantee doesn't get accidentally relaxed.

## 3. Optional rights field on Collab

Light-touch, collapsible. No required input.

**Schema:**
- Add `rights_arrangement text` to `collab_posts`, nullable, CHECK constraint limiting to: `owner_retains`, `equal_split`, `creative_commons`, or NULL.

**UI on `src/routes/collab.new.tsx`:**
- New collapsible section right above the Workshop block, labeled **"Rights (optional)"** with a one-line helper: "Set expectations now to avoid friction later."
- Closed by default — a single text link "Add a rights note" expands a small radio group with three plain-language options:
  - **Owner keeps publishing rights** — "You retain the final say on how the work is released. Collaborators are credited."
  - **Equal split among all participants** — "Everyone who ships on this owns an equal share."
  - **Creative Commons** — "Free for anyone to use with attribution (CC BY 4.0)."
- A small "Clear" link beside the group sets it back to null and collapses.
- No new validation; field is fully optional.

**UI on `src/routes/collab.$slug.tsx`:**
- When `rights_arrangement` is set, render a single line in the metadata strip next to comp/timeline: an icon (Scale from lucide) + the human label. No new section, no modal.

**Out of scope:** legal text, downloadable agreements, per-role rights overrides, percentage splits beyond "equal", any enforcement.

## Files touched

- New migration: `audience_city_ids` on workshops + `rights_arrangement` on collab_posts (single migration, both columns).
- `src/lib/collab-workshop.functions.ts` — populate `audience_city_ids` and `location_type`/`city_id` from source Collab.
- `src/routes/collab.new.tsx` — same population in scheduled-workshop insert; add Rights collapsible UI + state + insert.
- `src/routes/collab.$slug.tsx` — render rights label in metadata strip; verify-comment near owner-gating.
- `src/routes/workshops.index.tsx` — add fields to select, fetch viewer home_city_id, filter in JS, anon = unrestricted only.
- `src/components/workshop-card.tsx` — optional "City-only" chip when `audience_city_ids.length > 0`.

## Technical notes

- The viewer's `home_city_id` is on `profiles` and the workshops index already runs a per-user server fn (`getMyAgeFields`). To avoid a separate round-trip, extend that fn to also return `home_city_id` (rename target keys backward-compatibly: keep `age`, `ageFilterMin`, add `homeCityId`). Update both call sites.
- No RLS change needed — `workshops` already has `visibility = 'public'` filtering; `audience_city_ids` is a soft discovery filter applied client-side. Direct DB reads still work for the detail page.
- Migration includes `GRANT` review only — both target tables already have correct grants; we're adding columns, not new tables.

# Group Resources — v1

A curated list of useful places, services and organizations attached to a Group. Invisible until populated, admin-managed only, with a data model reusable for a future Workshop Directory.

## What the user sees

**Public (Group page)**
- A new "Resources" tab appears in the Group tab bar only when that Group has at least one published resource attached. Zero resources → the tab does not render at all (same tab bar drives desktop and mobile, so this is consistent by construction).
- The tab shows a simple header ("Resources" + "Places, services and organizations useful to this community.") and a restrained text-forward list: name, category, useful-for line, short description, location, and a "Website" link when present. Missing fields simply collapse.
- No ratings, reviews, maps, filters, or submissions.

**Admin (`/admin/resources`)**
- Create a resource: name, category, useful for, short description, website, location, address (optional), image (optional), field tags (optional), published toggle.
- List all resources with search; edit inline, publish/unpublish, delete.
- Attach a resource to one or more Groups (group picker by name), detach, and reorder within a Group.
- New "Resources" entry in the admin nav under "Manage".

## Data model

Two new tables, both additive — nothing existing changes.

`public.resources`
- `id`, `name`, `short_description`, `useful_for`, `category` (text, from a curated list), `website_url`, `location_text`, `address`, `image_url`, `city_id` (nullable FK to `cities`, for future Directory geo), `fields` (text[] of Workshop `FieldId`s), `created_by`, `is_published`, `created_at`, `updated_at` (+ updated_at trigger).

`public.group_resources`
- `id`, `group_id` → groups, `resource_id` → resources, `display_order` int default 0, `created_at`, unique (group_id, resource_id).

Because attachment lives in a join table, one resource can belong to many Groups, and later relationships (cities, fields, users/owners) are additive columns or additional join tables rather than a rewrite.

**Access rules**
- Anyone (including logged-out) can read published resources and their group links.
- Only admins can create, edit, or delete resources and group links, enforced both by RLS (`has_role(auth.uid(),'admin')`) and by an admin check inside the server functions.
- GRANTs: `SELECT` to `anon` and `authenticated`; full to `service_role`.

## Technical notes

- `src/lib/resources/types.ts` — curated `RESOURCE_CATEGORIES` list (supply store, studio, equipment rental, lab, fabrication, rehearsal space, printing, repair, professional services, arts organization, funding, education, other) plus label helpers. Field tags reuse `FIELD_OPTIONS` from `src/lib/taxonomy.ts`.
- `src/lib/resources.functions.ts` — `createServerFn` + `requireSupabaseAuth` + the existing `ensureAdmin` pattern (copied from `workshop-links.functions.ts`) for: list, create, update, delete, attach/detach to group, reorder.
- Public reads go through the browser `supabase` client with a plain `.select()` on `group_resources` joined to `resources` filtered on `is_published` — same shape as other group tabs.
- `src/components/group/group-resources-tab.tsx` — the list UI. External links use `target="_blank" rel="noopener noreferrer"`.
- `src/components/group/group-tab-bar.tsx` — add `"resources"` to `GroupTab` and conditionally splice the item in via a new `showResources` prop (mirrors the existing `showPosts` handling).
- `src/routes/g.$slug.index.tsx` — add `"resources"` to `TAB_VALUES`, a lightweight count query (`head: true, count: "exact"`) to decide tab visibility, and render the tab body. If the search param requests `t=resources` while the count is zero, fall back to the default tab.
- `src/routes/admin.resources.tsx` — admin CRUD screen following `admin.links.tsx` conventions; add nav entry in `src/routes/admin.tsx`.

## Out of scope for v1

Standalone `/directory` route or nav item, member submissions, moderator management, reviews/ratings, maps, sponsored placement.

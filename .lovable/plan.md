## Goal

Add a "Subgroups" section to the About tab of every group page:
- **Public read view** (everyone): list of child groups linked to this group, as compact cards. Hidden entirely when there are none.
- **Admin-only manager** (platform admins): search existing top-level groups and attach them as children of the current group; remove (unlink) existing children.

This piggybacks on the existing `setGroupParent` server fn and the `parent_group_id` column + max-depth trigger that already exist.

## Changes

### `src/routes/g.$slug.tsx` — `GroupAboutTab`

Extend the About tab body:

1. **Public list** — fetch children with React Query keyed `["group", group.id, "about-children"]`:
   - `select id, slug, name, kind, avatar_url, member_count from groups where parent_group_id = group.id and deleted_at is null order by member_count desc limit 50`
   - Render as a header `Subgroups (N)` plus a `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` of compact tiles (avatar + name + member count, linking to `/g/{slug}`).
   - Section is hidden when count is 0 AND viewer is not admin.

2. **Admin manager** (new `GroupSubgroupsManager` component, rendered only when `has_role(admin)` resolves true — reuse the same `useQuery(["is-admin", user?.id])` pattern already in `GroupEventsTab`):
   - Search input (debounced) → query `groups` where `name ilike %q%`, `parent_group_id is null`, `id <> group.id`, `kind <> 'city'` (cities can't nest under another group at depth 1), limit 10.
   - Each result row shows name + kind chip + an "Attach" button that calls `setGroupParent({ id: result.id, parent_group_id: group.id })`.
   - Each existing child row in the public list gets an extra "Unlink" button when admin → `setGroupParent({ id: child.id, parent_group_id: null })`.
   - On success: toast + `qc.invalidateQueries({ queryKey: ["group", group.id, "about-children"] })` and the children-count query used by the tab bar.

3. Place the new section above `<GroupNewsFeedSetting />` so admin tools cluster at the bottom of About.

### No DB / no server changes

- `setGroupParent` already exists with admin-gate + depth check trigger.
- `parent_group_id` exists on `groups`.

## UX notes

- Subgroup tiles in About are a *condensed* view; the dedicated "Subgroups" tab still shows the full grid for parents with children. The About preview deep-links into `?t=subgroups` via a "See all" link when count > 6.
- Manager UI uses existing shadcn `Input` + `Button` patterns to match the News feed card styling (rounded-2xl border, h3 heading).

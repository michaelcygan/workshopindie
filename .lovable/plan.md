# Group Nesting (v1)

Let any group be assigned as a sub-group of another group (one level deep). Surface children on the parent's page as a "Groups" tab. Vocabulary stays as just "Groups" — no new noun.

## Data model

Add to `public.groups`:
- `parent_group_id uuid null references public.groups(id) on delete set null`
- Index on `parent_group_id`
- Trigger `tg_groups_no_nested_parent`: reject if a group with `parent_group_id` is itself assigned as another group's parent (enforces single-level depth, in both directions: a child cannot become a parent, and a parent cannot become a child).
- Self-reference guard: `parent_group_id <> id`.

No new table — nesting is just a nullable FK. Existing `group_members`, `group_works`, `group_collabs`, `group_workshops`, `group_events` stay scoped to the specific group they were added to (no implicit roll-up in v1; we can add aggregation later without migration).

## Server functions

`src/lib/groups.functions.ts` — add:
- `setGroupParent({ group_id, parent_group_id | null })` — admin-only (uses existing `has_role` admin check pattern from `group-admin.functions.ts`). Validates depth rule.
- `listChildGroups({ parent_group_id })` — public read; returns id/slug/name/kind/member_count for non-deleted children, ordered by `member_count desc`.

Hosts of a group cannot reparent it themselves in v1 (keeps moderation simple); only platform admins can. Surface this in admin UI only.

## Admin UI

`src/routes/admin.groups.tsx`:
- In `EditGroupDialog`, add a "Parent group" combobox (searchable select of all non-deleted groups except self and except groups that already have children). Save via `setGroupParent`.
- In the admin table, show a small "↳ ParentName" chip under the slug when `parent_group_id` is set.

## Public group page

`src/routes/g.$slug.tsx`:
- Fetch `parent_group_id` and (if present) the parent's slug+name.
- Header: if child, render a small breadcrumb above the title — `← Chicago / Chicago Short Filmmakers`, linking to the parent.
- Tabs: insert a new "Groups" tab **only when the group has children**. Order: Collabs · Works · Workshops · Events · Groups · About. The tab renders a grid of child group cards (reuse existing `GroupCard`/group tile component used on `/groups`).
- Empty state on the Groups tab is suppressed — tab only appears when children exist, so no zero-state is needed.

## Membership prompt

When a user joins a group that has a `parent_group_id`, after the existing `joinGroup` mutation resolves:
- If they are not already a member of the parent, show a small dialog: "Also join Chicago?" with primary button "Join Chicago" (default-focused) and secondary "Not now."
- Implement in the existing join button component (find via `joinGroup` usage; likely `src/components/group-join-button.tsx` or inside `g.$slug.tsx`). Pass parent metadata fetched alongside the group.
- For logged-out users using the existing `SignupGateModal` join pattern, queue the parent-join prompt to fire after signup completes and the pending join replays (extend the existing pending-action ref pattern).

## Groups index

`src/routes/groups.index.tsx`:
- No structural change. Children remain listed alongside parents (so a user browsing all groups still finds "Chicago Short Filmmakers" directly).
- Add a subtle "in Chicago" caption under the name on child group cards.

## Out of scope for v1

- Multi-level nesting.
- Cross-posting works/collabs/events from child → parent automatically.
- Host-initiated reparenting (admin-only for now).
- Renaming "scene"/"micro" kinds — the `kind` enum stays as-is; nesting is orthogonal to kind.

## Technical notes

- Migration adds the column, index, self-ref check, and trigger in one file with appropriate `GRANT`s already in place on `groups`.
- `useMyGroups` is unchanged (flat list of memberships is still correct).
- SEO: child group pages get a `BreadcrumbList` JSON-LD entry (Home → Parent → Child) added to the existing schema block.

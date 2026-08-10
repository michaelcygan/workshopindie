# Group Resources v1 — verification pass

Resources v1 is already implemented and matches the spec. This plan covers the one thing still unverified: live behavior with real data.

## What I confirmed by inspection

- Tables `resources` (15 columns) and `group_resources` (5 columns) exist, with public read policies for published resources, admin-only write policies, and correct table permissions for anonymous, signed-in, and service roles.
- One resource can attach to many groups through the join table, with `display_order` for ordering — reusable for a future directory.
- The Resources tab is spliced into the group tab bar only when `showResources` is true, and that flag comes from a live count of published resources attached to the group. The same tab bar drives desktop and mobile, so behavior is consistent.
- Deep-linking `?t=resources` on a group with no resources silently falls back to Today.
- Admin screen at `/admin/resources` supports create, edit, publish toggle, delete, attach/detach to groups, and reorder; it is linked from the admin nav.
- No standalone directory route or nav item exists.
- Currently there are zero resource rows in the database, so no group shows the tab — existing groups are visually unchanged, as intended.

## What still needs verifying

Because there is no resource data yet, the appear/disappear behavior has never actually run. Steps:

1. Create one published test resource through the admin screen and attach it to a test group.
2. Load that group page signed out, on desktop and mobile widths: confirm the Resources tab appears, the list renders name, category, useful-for, description, location, and an external website link, and that sparse rows collapse gracefully.
3. Unpublish the resource, reload: confirm the tab disappears and `?t=resources` falls back to Today.
4. Attach the same resource to a second group to confirm multi-group attachment.
5. Delete the test resource so no seeded data is left behind.

Any defect found in these steps gets fixed in the same pass. If all steps pass, no code changes are needed.

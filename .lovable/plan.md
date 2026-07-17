## Easier event creation for admins

Two small additions, both admin-only, both pointing to `/admin/events` (the existing admin event creation surface).

### 1. Group Events tab — clickable empty state
File: `src/routes/g.$slug.tsx` (around lines 458–462)

Replace the static "The calendar is quiet…" paragraph with a variant that depends on `isAdmin`:
- If admin: render a dashed-border `<Link to="/admin/events">` styled as a full-width empty-state button with a `+` icon and copy "Add the first event to {group.name}" (subtext: "New events will appear here as they are added.").
- If not admin: keep the current passive message unchanged.

The existing small "+ Add event" pill in the header stays — this just makes the big empty area itself clickable so it matches the annotated screenshot.

### 2. Top-nav "+ Create" menu — add "Add event" (admins only)
File: `src/components/top-nav.tsx` (Create `DropdownMenuContent`, lines 104–111)

`isAdmin` is already destructured from `useUserRoles()` at the top of the file. Append a third `DropdownMenuItem`, gated by `{isAdmin && …}`, that navigates to `/admin/events` with a `Calendar` icon (already available in lucide) and label "Add event". Placed after "Post a Collab", separated by a `DropdownMenuSeparator` so it reads as an admin action rather than a standard user option.

### Out of scope
No changes to `/admin/events` itself, no per-group prefill, no new routes, no mobile Create menu changes (the existing pill in the group header already covers mobile admins on the Events tab).
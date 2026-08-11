# Admin photo editing on the group page

Add inline "Edit photo" controls to the group header so an admin can change the banner and the avatar without leaving the group page.

## What you'll see

- **Banner**: hovering the cover image (always visible on mobile) shows a small "Edit photo" button in the top-right corner of the banner — the spot circled in the first screenshot. If a group has no banner yet, the button still appears in a thin placeholder strip so a cover can be added.
- **Avatar**: hovering the square avatar tile shows a camera button in its corner — the area circled in the second screenshot.
- Both open the same small dialog: choose a file, see a preview while it uploads, and the header updates immediately after saving. A "Remove photo" option is included.
- Only platform admins see either control. Everyone else sees the header exactly as it is today.

## How it works

- A new `GroupPhotoEditor` component in `src/components/group/` handles both cases with a `target` of `cover` or `avatar`. It reuses the existing upload path (`uploadToBucket` from `src/lib/storage.ts`, `covers` and `avatars` buckets) and the same client-side resize/GIF rules used by the profile cover picker (JPEG downscale for photos, GIFs passed through under their own size cap).
- Saving calls the existing admin-only `updateGroup` server function in `src/lib/group-admin.functions.ts` with `{ id, cover_url }` or `{ id, avatar_url }`. No new server function, no new migration, no new policy — `updateGroup` already asserts the `admin` role server-side.
- `src/components/group/group-hero.tsx` gains the admin check (same `user_roles` query pattern already used in `group-event-directory.tsx`), renders the two buttons, and the cover block renders whenever the viewer is an admin even if `cover_url` is null.
- After a successful save the group query is invalidated so the header, and anything else reading the group, refresh.

## Notes

- The admin gate in the UI is convenience only; authorization stays server-side in `updateGroup`.
- Nothing else about the group header layout, tabs, or news ticker changes.

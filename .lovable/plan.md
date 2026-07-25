## Add a kebab menu with delete actions to each row on `/me/blog`

Edit `src/routes/me.blog.index.tsx` only.

### UI

- Add a `MoreVertical` kebab button on each row, placed just before the existing `ChevronRight`. Stop click/pointer propagation so tapping it doesn't navigate into the editor.
- Wrap the button in the existing shadcn `DropdownMenu` with a single destructive item:
  - Drafts (never published, `!p.published_at`): "Delete draft"
  - Published or previously-published: "Delete post" (drafts that were once published still resolve here)
- Gate visibility by access: only show the destructive item when the corresponding capability is true (`access.canDeleteNeverPublishedDraft` for drafts, `access.canPublish` / equivalent for published — reuse whatever the server allows; if no member-side delete-published capability exists yet, hide "Delete post" and note it in the plan). Confirm current member capabilities from `blog-access.server.ts` — `canDeleteNeverPublishedDraft` exists; there is no "delete published" capability, so **"Delete post" will require unpublishing first**. The menu will therefore show:
  - Draft never published → "Delete draft"
  - Published → "Unpublish" then "Delete post" appears after unpublish (or, simpler: show a disabled "Delete post" with helper text "Unpublish first"). Go with: show "Unpublish & delete" as a single destructive action for published rows that calls `unpublishMyBlogPost` then `deleteMyBlogDraft`, gated by `access.canUnpublish && access.canDeleteNeverPublishedDraft`.

### Confirmation

- Use shadcn `AlertDialog` (already used elsewhere in the project — verify; fall back to `Dialog` if not) with:
  - Title: "Delete this draft?" / "Delete this post?"
  - Body: "This can't be undone." (for published: "Your live post will be unpublished and deleted. This can't be undone.")
  - Cancel + destructive Confirm button.
- On confirm, call `useServerFn(deleteMyBlogDraft)` (and `unpublishMyBlogPost` first when applicable), then `queryClient.invalidateQueries({ queryKey: ["my-blog-posts", user?.id] })` and toast success/error.

### Wiring

- Reuse existing `useServerFn` imports; add `unpublishMyBlogPost` and `deleteMyBlogDraft` from `@/lib/blog-member.functions`.
- Track pending state per-row with a local `deletingId` so the menu item shows a spinner and disables while the mutation runs.
- No changes to server functions, access logic, or DB.

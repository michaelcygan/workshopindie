## Add "Posts" tab to Group pages

Surface blog posts authored by any member of the group, with an "All" + per-author chip filter, matching the Lounge Posts tab.

### Changes

1. **`src/components/group/group-tab-bar.tsx`**
   - Add `"posts"` to the `GroupTab` union.
   - Insert a `Posts` tab item (icon: `FileText`) between `Gallery` and `Events`. No count (keeps the tab bar clean; the list already shows counts inline).

2. **New: `src/components/group/group-posts-tab.tsx`**
   - Fetch group members (id, display_name, username, avatar_url) via `group_members` join to `profiles`, filtered by `group_id = group.id`. Cap ~500 to keep the payload small.
   - Reuse the existing `<LoungePosts participants={...} />` component — it already:
     - calls `listPostsByAuthors` server fn,
     - renders the "All" + per-author chip filter (only chips for authors who actually have posts),
     - opens posts in `BlogPostPeek`.
   - Wrap in the same section shell/styling used by other group tabs.

3. **`src/routes/g.$slug.index.tsx`**
   - Extend the `Tab` type / `?t=` accepted values with `"posts"`.
   - Render `<GroupPostsTab group={group} />` when `tab === "posts"`.

### Out of scope

- No new server function — `listPostsByAuthors` already accepts an arbitrary `profileIds` array, so it works unchanged for group members.
- No changes to the Lounge Posts component itself.
- No new DB tables or migrations.

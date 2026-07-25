# Continue Blog Entity Tagging — remaining wiring

Core logic, schema, and admin editor are done. This wave finishes the member editor, public rendering, and reverse-discovery mounts.

## 1. Member editor (`src/routes/me.blog.$id.tsx`)
- Load existing entity tags via `getBlogPostEntityTagsForOwner` on mount.
- Mount `BlogEntityTagsEditor` below the body editor.
- On save/publish, call `setBlogPostEntityTagsForMember` with the current list (before publish so visibility validation can gate publishing).
- Add the "@" entity-picker hook to the member's `BlogBodyEditor` instance (already supported via the shared toolbar).

## 2. Public article page (`src/routes/blog.$slug.tsx`)
- Read `entity_tags` from the loader (already returned by `getPublishedPostServer`).
- Render `<BlogEntityTags tags={post.entity_tags} />` under the article header/above the footer.
- Extend JSON-LD `about` / `mentions` arrays with entity URLs so search engines see the graph.

## 3. Reverse discovery — "From the Blog" mounts
Mount `<EntityBlogPosts kind=… entityId=… />` on:
- `src/routes/works.$slug.tsx` (kind: "work")
- `src/routes/collab.$slug.tsx` (kind: "collab")
- `src/routes/g.$slug.index.tsx` (kind: "group")
- `src/routes/g.$slug.e.$eventSlug.tsx` (kind: "event")
- `src/routes/u.$username.tsx` (kind: "profile") — also surface in `ProfilePeek` if trivial.

Place each mount near the bottom of the detail page, above the footer/related sections, and hide when the list is empty.

## 4. Verification
- Typecheck.
- Manually: tag a post as a member → publish → confirm chips render on `/blog/$slug` and the entity page shows the post in "From the Blog".

## Out of scope
- No new migrations. No changes to ranking beyond what wave 1 already shipped.

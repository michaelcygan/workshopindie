# Lounge → Posts tab

Add a fifth tab, **Posts**, to the Lounge tab bar (Chat · Gallery · Collabs · Links · **Posts**). It surfaces published blog posts authored by anyone currently in the room, filterable by author, opened inline so users never leave the Lounge.

## What ships

1. **New tab in the Lounge view toggle**
   - Add `"posts"` to `RoomViewMode` and render a `<TabButton>` with a `FileText` icon in the tab bar (both desktop and mobile-lite tab strips in `channel-view.tsx`).
   - Persist selection with the existing `viewMode` local-storage flow.

2. **`LoungePosts` panel** (new `src/components/lounge-posts.tsx`)
   - Props: `participantIds: string[]`, `profileLookup` (already used by Links/Gallery).
   - Query: `blog_posts` where `status = 'published'` AND (`author_id in participantIds` OR the post appears in `blog_post_authors` for a participant) — reuse the multi-author helper already in the blog functions layer.
   - Author filter chip row at the top: "All" + one avatar chip per participant who has ≥1 post. Chips reflect live room presence (recompute when `participantIds` change).
   - Editorial list using the existing `EditorialCard` treatment (cover, eyebrow "Posts", title, author, published date). Empty state: "No posts from people here yet."
   - Sorted newest first; capped at ~30.

3. **Peek-open reading** (new `src/components/blog-post-peek.tsx`, mirrors `WorkPeek`/`CollabPeek`)
   - `Dialog` on desktop, `Sheet` (bottom, drag-to-dismiss) on mobile — same pattern as existing peeks.
   - Renders the post via the existing markdown renderer + `BlogArticleFooter` (subscribe / related). "Open full page" link to `/blog/$slug` for those who want to leave.
   - Clicking a card in `LoungePosts` triggers the peek; Lounge audio/chat stays mounted underneath.

4. **Wiring in `channel-view.tsx`**
   - Add a `postsSlot` alongside the existing `linksSlot` for fullscreen/board rendering, and render `<LoungePosts …/>` in the standard tab-content switch.
   - Pass `participantIds` derived from the same source that feeds "Here now" so the author filter matches the room roster in real time.

## Out of scope

- No new DB tables/migrations — reuses `blog_posts` + existing author join.
- No changes to blog authoring, permissions, or homepage rails.
- No moderation changes (published posts are already moderated).

## Technical notes

- Query uses the existing server function pattern in `src/lib/blog.functions.ts` (add a `listPostsByAuthorIds(ids: string[])` if one doesn't already exist).
- `BlogPostPeek` reuses `react-markdown` config and `BlogArticleFooter` so styling matches `/blog/$slug`.
- Tab bar icon: `FileText` from `lucide-react`.
- No layout changes to the stage, chat, or sidebar — chat height clamp is preserved.

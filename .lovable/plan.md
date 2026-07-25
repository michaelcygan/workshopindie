## Goal
Bring the full-article conversion experience into the profile Blog peek modal so readers who open a post from a profile see the same subscribe form, "Join Workshop" CTA, and related-posts grid that appear at the bottom of `/blog/$slug`.

## Changes

### 1. Extract a reusable "Article footer" block
Create `src/components/blog-article-footer.tsx` containing:
- **Newsletter subscribe card** — email input + honeypot + Subscribe button, wired to `subscribeToNewsletter` from `@/lib/newsletter.functions` with `source: "blog_peek"` (peek) / `source: "blog_article"` (full page). Uses the same styling language as `site-footer.tsx` but sized for an in-article card.
- **"Make something with people." Join Workshop CTA** — same copy/gradient button as the current aside in `blog.$slug.tsx`.
- **"More from the blog" related grid** — takes an `excludeId` prop, calls `getRelatedPosts` via `useServerFn` + `useQuery`, renders the 3-up grid. In peek mode, clicking a related card swaps the peek to the new slug (calls an `onSelectPost(slug)` prop) instead of navigating; in article mode it renders `<Link>` to `/blog/$slug`.

Props: `{ postId, mode: "peek" | "article", onSelectPost?: (slug: string) => void }`.

### 2. Wire it into the peek modal
Update `src/components/blog-post-peek.tsx`:
- Render `<BlogArticleFooter postId={post.id} mode="peek" onSelectPost={…} />` inside the scrollable article container, above the sticky bottom action bar.
- When a related card is clicked, update the peek to the new slug: bubble up via a new optional `onNavigate(slug)` prop on `BlogPostPeek`, defaulting to swapping the internal slug through the parent.

### 3. Hook profile tab to peek navigation
Update `src/components/profile-blog-tab.tsx` (and the `u.$username.tsx` peek open state) so that selecting a related post from inside the peek updates both the URL `?post=` search param and the open peek slug — reuses the existing `onOpenPost` path.

### 4. Refactor `blog.$slug.tsx` to use the shared block
Replace the inline aside + related section with `<BlogArticleFooter postId={post.id} mode="article" />` so both surfaces stay in sync going forward. No visual change on the full article page.

## Out of scope
- No schema changes.
- No changes to the newsletter server function or related-posts server function.
- No changes to the Blog index page.

# Blog post → Blog post connections

Extend the existing "About this post" connection system so an author can deliberately connect their story to another published Workshop story. This is a directed editorial link (source → related), not a two-way backlink: no reciprocal row, no notification, no "Referenced by" section.

## Audit findings (confirmed)

- `blog_post_entity_tags` today has `work_id`, `collab_id`, `group_id`, `group_event_id`, `profile_id` and a `num_nonnulls(...) = 1` check — no target-post column. One additive migration is genuinely needed.
- `replace_blog_post_entity_tags` handles the five kinds and raises on anything else, then calls `sync_blog_medium_groups`.
- `BlogEntityKind` in `src/lib/blog-entity-tags.ts` stops at those five; the picker's `hitToBlogTag` explicitly throws for `post`.
- The shared entity layer already supports posts: `EntityConnectionPicker` has a `post` icon/label, `searchBlogPosts()` filters to published + listed + past publish time, `parseWorkshopHref` + `EntityLinkPreview` + `PostGlance` + `BlogPostPeek` already exist.
- Both editors differ today: `me.blog.$id.tsx` turns an inline insert into a structured connection; `blog-editor.tsx` (admin) only inserts markdown.

## Wave 1 — Migration

On `public.blog_post_entity_tags`:
- add `related_blog_post_id uuid references public.blog_posts(id) on delete cascade`;
- replace the exactly-one check to include the new column;
- add a check that `related_blog_post_id` is null or different from `blog_post_id`;
- index on `related_blog_post_id`; partial unique index on `(blog_post_id, related_blog_post_id)` where not null;
- update `replace_blog_post_entity_tags` to accept `{"kind":"post"}` writing `related_blog_post_id`, keeping atomic replace, `sort_order`, `created_by`, `sync_blog_medium_groups`, permissions.

Then regenerate types.

## Wave 2 — Types, validation, resolution

- `BlogEntityKind` gains `"post"`; label `Post`/`Posts`, icon `BookOpen`; `BlogEntityTag` union gains a post ref; `entityUrl` resolves `/blog/$slug`.
- Both validators (`blog-entity-tags.functions.ts`, `blog-member.functions.ts`) accept `post` for tag writes. The reverse rail input (`listBlogPostsForEntity`) keeps the existing five subject kinds — split the enums so the rail is not broadened.
- `blog-entity-tags.server.ts`: collect all `related_blog_post_id`s and resolve them in one batched query (id, slug, title, excerpt, cover, author name, published_at, status, show_in_blog_index), preserving `sort_order`. Add one shared predicate `blogPostIsPubliclyReferenceable()` used by public tag loading, bulk loading, existence validation, and the publish-time visibility assertion. Owner/admin loads keep unavailable targets visible so they can be removed; public loads omit them.

## Wave 3 — Authoring

- Picker: map `post` hits to a post tag; add `post` to `BLOG_KINDS`; search reuses `searchBlogPosts()`, showing recent eligible posts on empty query and excluding the current post, drafts/scheduled/unlisted, and already-connected posts.
- `BlogAboutEditor`: new final row after Events — `BLOG POSTS` / `+ Add a Blog post`, picker titled `Connect a Blog post` with the specified description. Entry renders cover thumb, title, author, open-in-new-tab, reorder, remove. Same 10-connection cap for all kinds; adding here never inserts prose.
- Admin editor gains the member editor's inline behavior: inserting a Workshop link also creates the structured connection, with the at-cap toast warning.

## Wave 4 — Public colophon

`BlogPostContext` gains a final `RELATED POSTS` row, rendered only when at least one eligible post remains: optional ~80px cover, title, byline, one-line excerpt, author order preserved, no pills or cards. Each entry wraps `EntityLinkPreview` with the post address so desktop hover/focus shows `PostGlance`, tap/click opens `BlogPostPeek`, and modifier-click reaches the canonical page. No new preview component.

## Wave 5 — Dedup, JSON-LD, cache

- `getRelatedPostsRankedServer()` excludes manually connected target ids, so "More from the blog" never repeats a manual pick; the algorithmic fallback stays.
- `contextMentions()` emits connected posts as `BlogPosting` nodes.
- After connection changes, invalidate the source post, its peek, and its related-post query. Public cache headers unchanged; no realtime.

## Wave 6 — Verification

Run the acceptance list: member and admin can connect a published post; self-connection and duplicates impossible; drafts/scheduled/unlisted absent; order survives reload; row renders last; hover glance loads no article body; peek on tap; modifier-click navigates; inline insert creates the connection; removing a connection leaves prose intact; unpublishing the target drops it publicly but stays visible to the owner; no overlap with "More from the blog"; existing kinds and reverse rails unaffected; typecheck, tests, production build pass. Report migration, files per wave, query behavior, and screenshots of both editors, the public row, desktop hover, and mobile peek.

# Reciprocal Work ↔ Blog Context

## Wave 0 — Audit findings (verified in repo)

- Work page: `src/routes/works.$slug.tsx` — loads work + `work_credits(role_label, sort_order, display_name, profiles(...))`; renders Credits (`WorkCreditLayer`), Comments, then `<EntityBlogPosts kind="work" …>` **last**, after comments.
- Blog page: `src/routes/blog.$slug.tsx` — SSR loader (`getPublishedPost`) already hydrates `entity_tags`; renders all tags as chips (`src/components/blog-entity-tags.tsx`) after the body.
- Reciprocal list: `src/components/entity-blog-posts.tsx` → `listBlogPostsForEntity` → `listBlogPostsForEntityServer` (`src/lib/blog-entity-tags.server.ts`). Correctly filters `status=published` and `published_at <= now`, but does **not** filter deleted/blocked authors or check contributor eligibility. Cards link away to `/blog/$slug` (no peek).
- Peek: `src/components/blog-post-peek.tsx` — full article dialog with cover, authors, body, footer reactions, copy link, unavailable state. Reusable as-is.
- Card: `src/components/editorial-card.tsx` exists and is the house card design.
- Editor: `src/routes/me.blog.$id.tsx` calls `flushEntityTags()` which **catches tag errors, toasts, and continues** — save still reports "Saved" and publish still proceeds. This is the correctness bug named in the brief. Admin editor `src/components/blog-editor.tsx` uses the same split path.
- Publish already calls `assertTaggedEntitiesPubliclyVisibleServer(id)` (`src/lib/blog-member.server.ts`), so publish-time leak protection exists; it just isn't reached when tag writes silently failed earlier.
- Picker: `src/components/blog-entity-tag-picker.tsx` queries `works` with `.in("visibility", ["public","unlisted"])` — unlisted must be dropped.
- Draft creation: `createMyBlogDraft` / `createMyBlogDraftServer` → RPC `create_member_blog_draft`; no initial-entity support.
- Schema: `works` already has `excerpt, category, categories, cover_url, cover_aspect, cover_focal_x, cover_focal_y, visibility, status, created_by`; `blog_post_entity_tags` has ordered `sort_order` and an RPC `replace_blog_post_entity_tags`. **No migration required.**
- Analytics: no general client analytics utility exists (only Lounge telemetry). Skip analytics per "do not create new infrastructure".

## Wave 1 — Make tagging reliable

- `src/lib/blog-member.functions.ts` + `blog-member.server.ts`: add `tags` to `updateMyBlogPost` (optional, validated, max/ dedupe server-side) and apply them via the existing `replace_blog_post_entity_tags` RPC in the same handler; any tag failure throws so no success state is shown.
- `src/routes/me.blog.$id.tsx`: send tags with the save mutation, delete `flushEntityTags`'s swallow; publish path saves first and aborts on error.
- `src/components/blog-editor.tsx` (admin): same single-call pattern using the admin tag setter, failures propagate.
- Cache invalidation helper in `src/lib/blog-entity-tags.ts` (client-safe): given previous + next tags, invalidate `["entity-blog-posts", kind, id]` for the union, plus existing `["my-blog-posts"]`, `["blog-post", id]`, `["blog-peek", slug]`. Called after save, publish, unpublish, delete.
- Picker: works search restricted to `visibility = 'public'`.
- `listBlogPostsForEntityServer`: also exclude posts whose entity is no longer publicly visible and respect existing blocking helpers.

## Wave 2 — Work context on the Blog post

- `src/lib/blog-entity-tags.server.ts`: extend the work branch of `resolveTags` to attach a `work` summary (slug, title, excerpt, category/categories, cover_url + aspect/focal, up to 3 credits from `work_credits` → `profiles`), public works only. Types extended in `src/lib/blog-entity-tags.ts`. Loaded in the existing SSR loader — no client waterfall.
- New `src/components/blog-work-context.tsx`: "WORK IN THIS STORY" horizontal card (cover w/ focal position, category, title, one-line excerpt, up to 3 credited creators, "View Work →"). Multiple works → "Works in this story", restrained grid, max 3 rich + remainder as chips; single column on mobile.
- `src/routes/blog.$slug.tsx`: render it after byline / before body; filter work tags out of the lower `BlogEntityTags` chip row (other kinds unchanged). Omit entirely if summary is missing.

## Wave 3 — Blog context on the Work page

- Move the reciprocal section in `src/routes/works.$slug.tsx` to sit after description/source action and before Credits.
- Rewrite `src/components/entity-blog-posts.tsx` into a work-aware editorial section: "FROM THE BLOG / The story behind this Work", 1 / 2 / 3+ responsive layouts built on `EditorialCard`, max 6, hidden when empty, no "All posts" link.
- Eligibility (server, in `listBlogPostsForEntityServer` with a `trustedOnly` mode for kind `work`): surface only posts authored/attributed to the work creator, a credited collaborator, or an editorial/admin publication (`publication_type`). Other members' posts keep their own Blog-side context only.
- Role-aware byline derived by matching `blog_post_authors.profile_id` against `work_credits` (supports legacy single-author too) — no new fields.
- Peek: add a validated search param `story` on the works route (`fallback(z.string(), "")`), open `BlogPostPeek` from it. Clicking a card navigates (Back closes the peek), direct URL opens it, close resets to the clean URL, and the slug is verified against the eligible list before opening.

## Wave 4 — "Write about this Work"

- `createMyBlogDraft` gains optional `initialEntity: { kind: "work", id }`; server verifies blog access, verifies the work is public + published, creates the draft, then inserts the single tag; duplicates prevented.
- Contextual action rendered for the signed-in work creator or credited contributors near the blog section; navigates to `/me/blog/$id` with the work already in "Connected to this post".
- When a work has no eligible posts, contributors see a quiet private nudge ("Add context to this Work") with the same action; signed-out and non-contributors see nothing.

## Verification per wave

Typecheck + lint + production build; manual passes on `/works/$slug` and `/blog/$slug` at 320/390/430 px and desktop; peek Back/Escape/direct-URL behavior; tag-failure path shows an error and no false success; draft/publish/unpublish/delete refresh the work page immediately.

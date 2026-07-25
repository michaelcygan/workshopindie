# Blog Entity Tagging

Structured, first-class relationships between Blog posts and Workshop entities (Work, Collab, Group, Event, Profile). One shared implementation across admin and member editors, reusing the existing mention-suggestion infrastructure.

## 1. Database (single migration)

New table `public.blog_post_entity_tags`:
- `blog_post_id → blog_posts(id) on delete cascade` (not null)
- Nullable FKs: `work_id, collab_id, group_id, group_event_id, profile_id` (each `on delete cascade`)
- `sort_order int not null default 0`
- `created_by → auth.users`, `created_at`
- CHECK: exactly one of the entity FKs non-null (`num_nonnulls(...) = 1`)
- Partial unique indexes per entity FK (prevent duplicates per post)
- Indexes on every FK + `blog_post_id`

GRANTs: `SELECT` to `anon, authenticated`; full CRUD to `authenticated`; `ALL` to `service_role`.

RLS:
- `SELECT`: public may read only when the parent `blog_posts` row is `status='published' AND published_at <= now()`; owners and admins can read their own/all.
- `INSERT/UPDATE/DELETE`: post owner (matching existing blog edit rules via `has_blog_edit_access` or equivalent) or admins.

Regenerate Supabase types after migration.

## 2. Shared model — `src/lib/blog-entity-tags.ts`

- `BlogEntityKind = "work" | "collab" | "group" | "event" | "profile"`
- Discriminated `BlogEntityTag` union with `label, image, sublabel`, plus `slug`/`username`/`groupSlug` as appropriate
- Helpers: `fromMentionSuggestion`, `entityUrl(tag)`, `tagKey(tag)`, `kindLabel(tag)`, `kindIcon(tag)`, `normalizeRow(row, resolved)`

## 3. Server functions — `src/lib/blog-entity-tags.functions.ts` + `.server.ts`

- `getBlogPostEntityTags({ postId })` — authorize (owner / admin / public if published), batch-fetch entities by kind, return ordered `BlogEntityTag[]`. Filter non-public entities out of the public response.
- `setBlogPostEntityTags({ postId, tags })` — require edit access; enforce max 10, dedupe by `kind+id`, validate every referenced entity exists; atomic replace via Postgres RPC (`replace_blog_post_entity_tags(post_id, jsonb)`) inside a single transaction; return normalized tags.
- `listBlogPostsForEntity({ kind, entityId, limit=3, max=6 })` — return published post summaries (id/title/slug/excerpt/cover/author_name/published_at) joined via the tag table.
- Publish path additionally validates all currently-attached entities are publicly viewable; if not, throw a user-facing error: "One of the entities connected to this post is no longer public. Remove it before publishing."

Extend existing `adminGetPostServer`, `getMyBlogPostServer`, `getPublishedPostServer` return shapes with `entity_tags: BlogEntityTag[]`.

## 4. Picker — `src/components/blog-entity-tag-picker.tsx`

- Dialog with search input, kind filter tabs (All / Works / Collabs / Groups / Events / People)
- Reuses `useMentionSuggestions` from `src/lib/mention-suggestions.ts`; a Blog-specific wrapper hook applies tighter public-visibility filters (published Work, public Group, upcoming public Event, etc.) without altering chat behavior.
- Shows avatar/thumb, name, sublabel, selected state, keyboard nav, empty + loading states, 44px touch targets.

## 5. Structured tags editor — `src/components/blog-entity-tags-editor.tsx`

- Heading "Connected to this post", helper copy, `+ Tag something`, up to 10 chips with icon/thumb, name, kind, remove, up/down reorder.
- Rendered in both `src/components/blog-editor.tsx` (admin) and `src/routes/me.blog.$id.tsx` (member) after excerpt/cover, before body.
- Participates in dirty tracking in both editors.

## 6. Body editor toolbar — `src/components/blog-body-editor.tsx`

- New toolbar button (AtSign icon, tooltip "Tag a Workshop item") opens the same picker.
- On select: insert canonical markdown link at textarea cursor, call new optional `onEntityTag(tag)` prop so the parent adds it to structured tags (dedup by kind+id), refocus textarea.
- Removing a chip does not rewrite body; removing an inline link does not remove the chip.

## 7. Save flow

Admin editor: create/update post → save attributed authors → `setBlogPostEntityTags` → clear dirty only after all succeed; surface error if tags save fails.

Member editor: single Save → article fields, tags atomically replaced; invalidate `["my-blog-post", id]`, `["my-blog-posts", userId]`, and public blog queries when published. Publish path server-validates tags.

## 8. Public rendering

- New `src/components/blog-entity-tags.tsx` rendered in `src/routes/blog.$slug.tsx` as a quiet "Connected to" strip below byline. Nothing rendered when empty. Chips use TanStack `Link` to canonical routes:
  - `/works/:slug`, `/collab/:slug`, `/g/:slug`, `/g/:groupSlug/e/:eventSlug`, `/u/:username`
- `src/routes/blog.index.tsx` cards: append up to 2 compact entity labels + `+N` under excerpt.
- `getRelatedPostsServer` reworked: rank other published posts by count of shared tagged entities desc, then `published_at` desc; fill remaining slots with recent posts. Still capped at 3 in `blog-article-footer.tsx`.

## 9. Reverse discovery — `src/components/entity-blog-posts.tsx`

Props `{ kind, entityId, heading="From the Blog", limit=3 }`. Queries `listBlogPostsForEntity`. Renders nothing when empty. Mounted on:
- `src/routes/works.$slug.tsx`
- `src/routes/collab.$slug.tsx`
- `src/routes/g.$slug.index.tsx`
- `src/routes/g.$slug.e.$eventSlug.tsx`

Placed after the entity's primary content, before generic recommendations/footer. Profile pages excluded in V1 (attribution ≠ mentions).

## 10. SEO

In `src/routes/blog.$slug.tsx`, extend the `BlogPosting` JSON-LD `about`/`mentions` arrays with publicly-viewable tagged entities only (`CreativeWork` for Work/Collab, `Organization` for Group/Event, `Person` for Profile), using absolute `workshopindie.com` URLs.

## 11. Non-goals / guardrails

- No tag-based notifications in V1.
- No moderation on tag fields (entities are trusted DB records; server validates existence + visibility).
- No new npm packages.
- No Lounge tagging.
- No profile "Mentioned in" section (deferred).

## Files touched

Add:
- `supabase/migrations/<ts>_blog_entity_tags.sql`
- `src/lib/blog-entity-tags.ts`
- `src/lib/blog-entity-tags.functions.ts`
- `src/lib/blog-entity-tags.server.ts`
- `src/components/blog-entity-tag-picker.tsx`
- `src/components/blog-entity-tags-editor.tsx`
- `src/components/blog-entity-tags.tsx`
- `src/components/entity-blog-posts.tsx`

Edit:
- `src/components/blog-editor.tsx`, `blog-body-editor.tsx`, `blog-article-footer.tsx`
- `src/routes/me.blog.$id.tsx`, `blog.index.tsx`, `blog.$slug.tsx`
- `src/routes/works.$slug.tsx`, `collab.$slug.tsx`, `g.$slug.index.tsx`, `g.$slug.e.$eventSlug.tsx`
- `src/lib/blog.functions.ts`, `blog.server.ts`, `blog-member.functions.ts`, `blog-member.server.ts`
- `src/lib/mention-suggestions.ts` (add optional Blog-visibility config; no chat behavior change)
- `src/integrations/supabase/types.ts` (regenerated)

## Verification

Typecheck + build; manual: tag each of the 5 entity kinds in both admin and member editors, publish, confirm chips on public post, reverse section on each entity page, related-post ranking prefers shared tags, private entities blocked on publish.

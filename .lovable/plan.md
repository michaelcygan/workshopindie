## Wave 7 — Hardening: lifecycle, perf, security

Finish the Plus Member Blogging system by locking down the lifecycle transitions, tightening the public surface, and closing the perf gaps identified in earlier waves.

### 1. Lifecycle enforcement (server truth)

Re-audit `src/lib/blog-member.server.ts` against `BlogAccess` so the mode from `blog_writer_access_state` is the single source of truth on every write:

- `createMyBlogDraftServer` → gate on `canCreateDraft` and enforce `activeDraftLimit` (trial=1, lapsed/suspended/free=0) with a targeted count query.
- `updateMyBlogPostServer` → allow only when `canEditExisting`; block publishing-adjacent fields (slug on published posts) even for owners.
- `publishMyBlogPostServer` → require `canPublish`; also enforce the cover-alt + title checks that admin publish already runs.
- `unpublishMyBlogPostServer` → allow only when `canUnpublish` (lapsed/suspended stay allowed by spec).
- `deleteMyBlogDraftServer` → require `canDeleteNeverPublishedDraft` **and** `published_at IS NULL`.
- All five: reject when the caller is not the owner (`created_by = userId`) even if RLS also blocks it — return a clean 403-style error instead of a raw Postgres message.

Add a `lifecycle.test.ts` note in the migration description (no test infra required) — just confirm by reading the server file after edits that every path calls `resolveBlogAccess` once and switches on the resolved capability, not on the raw subscription table.

### 2. Public surface: sanitization + noindex parity

- `src/components/blog-post-body.tsx` — verify the markdown renderer's `rehype-sanitize` schema strips `<script>`, `<iframe>`, `on*` handlers, and `javascript:` URLs. If it uses the default schema, tighten it to an allow-list (headings, paragraphs, lists, links with `rel="noopener nofollow ugc"` on member posts, images, code, blockquote, hr).
- `src/lib/blog.server.ts` — annotate member post links (`publication_type === "member"`) with `nofollow ugc` in the sanitizer post-processing so member posts can't launder link equity.
- `src/routes/blog.$slug.tsx` — extend the `noindex` rule to also cover `publication_type === "member" && show_in_blog_index === false` explicitly (already covered by the show_in_blog_index check, but assert once in code and add a comment).

### 3. RLS + grants audit for the blog surface

Read-only sweep with `supabase--read_query`, then a single consolidated migration if gaps exist:

- `blog_posts` — anon SELECT limited to `status = 'published' AND published_at <= now()`; authenticated writers can only touch rows where `created_by = auth.uid()` for `member` posts; admins pass via `has_role`.
- `blog_post_authors` — anon SELECT allowed (needed for public byline join); writes admin-only.
- `blog_writer_access` — no anon; SELECT self + admin; writes admin-only (already covered by wave-4 findings, just confirm).
- `newsletter_subscribers` — INSERT allowed to anon (single email), SELECT admin-only.

If any policy is missing, ship one migration `2026xxxx_blog_hardening.sql` with the deltas + GRANTs.

### 4. Performance pass

- `src/components/blog-post-body.tsx` — add `loading="lazy"` + `decoding="async"` to inline markdown images; keep the first image eager for LCP by adding `fetchpriority="high"` to the cover image in `blog.$slug.tsx` and `head().links` preload for `cover_image_url`.
- `src/lib/blog.server.ts` — `listProfileBlogPostsServer` currently fetches `blog_post_authors` then does a second `blog_posts` query. Confirmed acceptable (single join + keyset). Add an index check: verify `blog_post_authors (profile_id)` and `blog_posts (published_at DESC, id DESC) WHERE status='published'` exist; if not, add them in the same hardening migration.
- `src/components/home-blog-rail.tsx` and profile-blog-tab lists — add `loading="lazy"` to thumbnail imgs.
- Cache headers: verify `blogPublicCacheHeader()` is set on `listPublishedPosts`, `getPublishedPost`, `getRelatedPosts`, `listProfileBlogPosts` (already done in wave 5); add same header to the RSS route and the sitemap route for blog entries.

### 5. Files touched

- `src/lib/blog-member.server.ts` — lifecycle gates.
- `src/components/blog-post-body.tsx` — sanitizer schema + lazy images.
- `src/routes/blog.$slug.tsx` — LCP preload, eager cover.
- `src/components/home-blog-rail.tsx`, `src/components/profile-blog-tab.tsx` — lazy imgs.
- `src/routes/blog.rss[.]xml.ts`, `src/routes/sitemap[.]xml.ts` — cache headers.
- Possibly one migration for missing RLS/GRANTs/indexes (only if the audit finds gaps).

### Out of scope

- No new user-facing UI or copy changes.
- No changes to the editor UX; hardening only.
- No changes to admin flows shipped in wave 6.

After this wave the Plus Member Blogging system is feature-complete against the master prompt.
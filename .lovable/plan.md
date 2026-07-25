Continue the Plus Member Blogging build with the remaining scope from Waves 5–7. Wave 4 shipped (nav, settings, pricing/plus-gate copy, checkout return). Wave 5 partially shipped (tab reorder, global `show_in_blog_index` filter across public index/RSS/sitemap/pulse) and the two room-pin RLS findings are resolved.

## Wave 5 — Profile & distribution (finish)

- Add canonical share actions on `/blog/$slug` (Copy link + native share) reusing existing share utilities; ensure canonical URL always points to `workshopindie.com/blog/<slug>` regardless of author profile context.
- Add a "Report post" affordance on published posts (visible to signed-in non-authors) that files into the existing `reports` table with `entity_type='blog_post'`; wire moderation trigger already covers content on write, this adds user-flagging.
- Profile blog tab: confirm pagination (12/page infinite scroll) and that only `show_in_blog_index = true` posts appear on the public tab; author's own view continues to include hidden posts.
- Ensure member-authored posts with `show_in_blog_index=false` still resolve at `/blog/$slug` (direct URL) but are excluded from index/RSS/sitemap/pulse (already done) — add `noindex` meta on those direct pages.

## Wave 6 — Admin

- `/admin/blog`: add filter chips for Publication type (Editorial / Member), Status (Draft / Published), Visibility (In index / Hidden), and a search-by-author input. Extend `listAdminBlogPosts` server fn with the new filter params.
- `/admin/users/$id`: add a "Blog access" panel showing current mode from `blog_writer_access_state`, active/published counts, and admin actions: Grant writer access, Revoke, Suspend publishing, Restore. Persist via `blog_writer_access` table with audit log entries.
- Add "Unpublish" and "Hide from index" quick actions on admin blog list rows.

## Wave 7 — Hardening

- Performance: batch author lookups in `listPublishedPostsServer` and profile feed to remove N+1; add `loading="lazy"` + `decoding="async"` to all blog images (cover + inline via `BlogPostBody`); set long cache headers on `/blog/rss.xml` and `/sitemap.xml` route responses.
- Security audit: verify RLS on `blog_posts`, `blog_post_authors`, `blog_writer_access`, `newsletter_subscribers`; confirm markdown renderer disables raw HTML and sanitizes links (target=_blank + rel=noopener); rate-limit `createMyBlogDraft` and `publishMyBlogPost` per user.
- Lifecycle QA: trial → plus (unlocks publish), plus → lapsed (edit/unpublish only, no new drafts), suspended (no writes), granted (bypasses Plus). Add server-side assertions in `publishMyBlogPostServer` so a lapsed user cannot flip a draft to published even by racing the client.
- Verify: run typecheck, load `/blog`, `/me/blog`, `/admin/blog`, a member-published post, and a hidden post URL; check console + network for errors.

## Technical notes

- Reuse existing `share.functions.ts` and `reports` schema — no new tables except (if needed) a lightweight `blog_writer_access` audit expansion; prefer using existing `admin_audit_log`.
- All new server fns use `createServerFn` with `requireSupabaseAuth`; admin fns gate on `has_role(auth.uid(),'admin')`.
- Keep `resolveBlogAccess` as the single source of truth for capabilities; UI reads from `getMyBlogAccess` only.

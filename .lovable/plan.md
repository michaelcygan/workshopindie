## Surface attributed blog posts on member profiles

Extends the existing blog CMS with a proper multi-author attribution model and a conditional Blog tab on `/u/$username` that opens articles in a URL-backed peek.

### 1. Attribution data model (additive migration)

New table `public.blog_post_authors`:

- `blog_post_id uuid → blog_posts(id) on delete cascade`
- `profile_id uuid → profiles(id) on delete cascade`
- `sort_order int not null default 0`
- `role_label text null`
- `created_at timestamptz default now()`
- PK `(blog_post_id, profile_id)`; index on `(profile_id, sort_order)` and `(blog_post_id, sort_order)`

GRANTs + RLS:

- `GRANT SELECT ON blog_post_authors TO anon, authenticated`; write to `authenticated` + `service_role`.
- Public SELECT policy joins to `blog_posts` and only exposes rows where `status='published'` and `published_at <= now()`.
- Admin insert/update/delete uses the existing admin authorization helper (same helper as `blog_posts` write policies).

Also add a helper SQL function `public.profile_published_blog_count(profile_id uuid) returns int` (SECURITY DEFINER, stable) that counts published, non-future posts attributed to the profile — used by the SEO loader to avoid pulling rows.

The existing 111 imported Michael Cygan posts get backfilled in the same migration by inserting `(post.id, michaelcygan.profile_id, 0)` for every currently attributed post (matching by the current `author_profile_id` column, if present, or by `author_name = 'Michael Cygan'` as a fallback). The existing `author_profile_id` column stays for now as a read-only compatibility field; the tab and JSON-LD read from the join table.

### 2. Admin editor: Authors field

Extend `src/components/blog-editor.tsx` and `src/lib/blog.functions.ts` / `blog.server.ts`:

- New server fn `adminSearchAuthorProfiles({ q })` returning `{ id, username, display_name, avatar_url }` (reuses existing `adminListAuthorProfiles` shape, adds search).
- New server fn `adminSetPostAuthors({ post_id, authors: [{ profile_id, role_label? }] })` that replaces the row set inside a transaction, preserving order via array index.
- Editor UI: async combobox (existing shadcn primitives) → selected authors render as reorderable chips with avatar + display name + `@username` + optional role label. First chip is primary. Never auto-infer from the current admin.
- Save path calls `adminSetPostAuthors` after the post upsert.

### 3. Public article page updates

`src/routes/blog.$slug.tsx`:

- Load attributed authors alongside the post (single query with join).
- Render each author name as a link to `/u/$username?tab=blog`.
- JSON-LD `author` becomes an array of `Person` objects (name + `url`), one per attributed profile. Fall back to the existing Workshop `Organization` when none.
- Canonical, OG, Twitter, and route path unchanged.

### 4. Profile loader: add ID + published blog count

Extend `getProfileSeo` in `src/lib/seo-loaders.functions.ts` to also return `id` and `published_blog_count` (via the SQL helper above). Cache header unchanged. No article rows fetched. This piggybacks on the existing profile fetch — no extra client round-trip and no tab-bar layout shift.

### 5. Conditional Blog tab on `/u/$username`

In `src/routes/u.$username.tsx`:

- `TAB_VALUES = ["works", "blog", "collabs", "activity", "about"] as const` (blog inserted after works).
- Extend `profileSearch` with `post: z.string().trim().max(200).optional()`.
- Add `blog: publishedBlogCount` to the counts map.
- `visibleTabs` filter: include `blog` only when `publishedBlogCount > 0`.
- Guard: if `tab === "blog"` but count is 0, `navigate({ replace: true, search: { tab: undefined, post: undefined } })` once on mount.
- Tab renders `<ProfileBlogTab profileId={profile.id} username={username} />` — the query inside only runs when `currentTab === "blog"`.

### 6. `ProfileBlogTab` + `listProfileBlogPosts`

New server fn `listProfileBlogPosts({ profileId, cursor?, limit=12 })`:

- Joins `blog_post_authors → blog_posts`, filters `status='published' AND published_at <= now()`.
- Selects card fields only: `id, slug, title, excerpt, cover_image_url, cover_image_alt, published_at`.
- Order `published_at DESC, id DESC`; keyset cursor `{ published_at, id }`.
- Server-side `limit = min(limit, 24)`.
- Returns `{ posts, nextCursor }`.

New `src/components/profile-blog-tab.tsx`:

- `useInfiniteQuery` with `enabled: currentTab === "blog" && publishedBlogCount > 0`.
- IntersectionObserver sentinel with ~600px root margin (mirroring `src/routes/gallery.tsx`) + visible “Load more” fallback button.
- Dedup by ID; skeleton grid inside the tab only.
- 2-col grid on mobile, 3-col on desktop where space permits. Fixed cover aspect ratio, `loading="lazy"`, `decoding="async"`, cover alt with title fallback. Title, short excerpt, published date. Match existing card typography/borders/hover.

### 7. `BlogPostPeek` — URL-backed popup

New `src/components/blog-post-peek.tsx` modeled on `src/components/work-peek.tsx`:

- Card renders as a real `<a href="/blog/$slug">` for SEO + no-JS + middle/modifier-click. Ordinary unmodified click → `preventDefault()` + `navigate({ search: (prev) => ({ ...prev, post: slug }) })`.
- Peek opens whenever `search.post` is present; fetches the article via the existing published-post server function (`getPublishedPostBySlug` in `blog.functions.ts`) — no duplication.
- Renders body with the existing shared `BlogPostBody` renderer.
- Desktop: large scrollable `Dialog`. Mobile: near-fullscreen sheet-style dialog using existing responsive primitives. Skeleton while loading.
- A11y: focus trap, Escape closes, labelled title, visible close, focus restoration. Closing removes only `post` from search. Browser Back closes the peek (URL history integration via `navigate`, not `replace`).
- Invalid/draft/future/deleted slug → restrained “This post isn’t available.” state, no body leak.
- Footer actions inside the peek: “Copy link” (canonical `https://workshopindie.com/blog/$slug`) and “Open full article” (`<a href="/blog/$slug">`). The profile query-string URL is never treated as the share URL.

### 8. SEO invariants (unchanged)

- `/blog/$slug` remains the sole canonical article URL with its existing head/JSON-LD.
- `/u/$username` canonical stays parameterless — no per-`post` metadata is emitted from the profile route.
- `/blog` index, RSS, and sitemap continue linking directly to `/blog/$slug`.

### 9. Verification

- Type + build after the migration types regenerate.
- Playwright pass: (a) profile with no attributions has no Blog tab; (b) attributing a draft doesn’t reveal it; (c) publishing surfaces it with correct count; (d) initial profile response contains no card rows (network panel); (e) opening Blog fetches ≤ 12 rows; (f) infinite scroll paginates without dupes; (g) card click opens peek without navigation, Back closes it, direct `?tab=blog&post=...` load opens correctly; (h) `/blog/$slug` still renders standalone; (i) multi-author post appears on every attributed profile; (j) removing an attribution removes it from the profile.

### Technical notes

- No new dependencies. Reuses shadcn `Dialog`, existing `BlogPostBody`, existing infinite-query pattern from `gallery.tsx`, existing peek pattern from `work-peek.tsx`, existing admin auth helper, and existing TanStack Query/Router conventions.
- Attribution table is additive; the existing `author_profile_id` column stays for backward compat but new UI reads the join table.
- Public SELECT on `blog_post_authors` filters via the join to `blog_posts` (published + non-future) so unpublished attributions never leak.
- `listProfileBlogPosts` and `profile_published_blog_count` are single-query, no N+1.

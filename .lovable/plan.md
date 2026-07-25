## Workshop native blog CMS + shared footer + subscriber capture

Small, native blog module inside the existing Workshop app. Reuses TanStack Start routes, Supabase RLS, `user_roles`/`has_role`, `admin_audit_log`, `requireSupabaseAuth`, existing `ImageUpload` (`covers` bucket), `react-markdown` + `remark-gfm`, current design tokens, and the existing sitemap route. No new deps, no package upgrades, no edits to `src/routeTree.gen.ts`.

---

### Wave 1 — Data & server contract

**Migration** (`blog_posts` + `newsletter_subscribers`):

- `public.blog_posts` with fields per spec. CHECK constraints for `status IN ('draft','published')` and length caps (title 160, slug 120, excerpt 320, seo_title 80, seo_description 160, cover_alt 240). Index on `(status, published_at desc)`. `updated_at` trigger reuses `public.tg_set_updated_at()`.
- GRANTs: `SELECT` to `anon` + `authenticated`; full CRUD to `authenticated` (gated by policies); `ALL` to `service_role`.
- RLS policies:
  - anon/authenticated `SELECT` where `status='published' AND published_at <= now()`.
  - admin (`has_role(auth.uid(),'admin')`) full CRUD.
- Trigger `blog_posts_publish_guard`:
  - On INSERT/UPDATE: if slug changes and OLD.published_at IS NOT NULL → raise.
  - On UPDATE: if status flips to `published` and `published_at` is null → set to `now()`; if already published, preserve original `published_at`.
- `public.newsletter_subscribers` per spec. Unique index on `lower(email)`. RLS: no anon/authenticated policies (writes only via server function with service role). GRANT `ALL` to `service_role` only.

**Server module** `src/lib/blog.functions.ts` (uses current non-deprecated validator API):

Public (no auth, cached `public, s-maxage=60, stale-while-revalidate=600`):
- `listPublishedPosts()` — cards only (no body).
- `getPublishedPost({ slug })` — full row.
- `getRelatedPosts({ excludeId, limit: 3 })`.

Admin (`requireSupabaseAuth` + re-assert `has_role(...,'admin')`, no cache):
- `adminListPosts`, `adminGetPost`, `adminCreateDraft`, `adminUpdatePost`, `adminPublishPost`, `adminUnpublishPost`, `adminDeleteDraft` (rejects if ever published).
- All writes Zod-validated. Slug generation via `public.slugify()` + collision loop (`-2`, `-3`, …). Slug edits allowed only while `published_at IS NULL` (server-side check in addition to DB trigger). Each write inserts an `admin_audit_log` row (`blog_post.created|updated|published|unpublished|deleted`).

**Subscriber server module** `src/lib/newsletter.functions.ts`:
- Public `subscribeToNewsletter({ email, website /* honeypot */ })`:
  - Honeypot must be empty; else return generic success.
  - Zod email, lowercased. Rate limit via existing daily-salted-hashed-IP pattern (mirrors guest Collab submission). Never store raw IP.
  - Uses `supabaseAdmin` (loaded inside handler) to upsert: new → insert; existing `unsubscribed` → reactivate (`status='subscribed'`, clear `unsubscribed_at`); existing `subscribed` → no-op. Always returns generic `{ ok: true }`.
- Admin `adminListSubscribers`, `adminExportSubscribersCsv` — admin-gated.

---

### Wave 2 — Admin CMS

- Add **Content** nav group to `src/routes/admin.tsx` with `Blog` entry.
- `src/routes/admin.blog.index.tsx` — posts list (title, status, published_at, updated_at, Edit, Open public).
- `src/routes/admin.blog.new.tsx` and `src/routes/admin.blog.$id.tsx` — editor:
  - Fields: title, slug (locked once published, with public URL preview), excerpt, cover via existing `ImageUpload bucket="covers"` (landscape), cover alt (required before publish if cover exists), markdown body, optional seo_title/seo_description, author_name (default "Workshop").
  - Toolbar: H2, H3, bold, italic, link, quote, ul, ol, image-by-URL — pure textarea insertions.
  - Edit / Preview tabs using the shared `BlogPostBody` (Wave 3) so preview == public.
  - Word count, reading time, char counters (seo_title/description), Google-style search preview, social card preview.
  - Actions: Save Draft, Publish, Unpublish, View Published, Delete Draft (only when never published, with confirm), unsaved-change warning.
- `src/routes/admin.blog.subscribers.tsx` — count, table, CSV export via admin server fn.

---

### Wave 3 — Public blog

- `src/components/blog-post-body.tsx` — shared `react-markdown` + `remark-gfm` renderer. No raw HTML, no `rehype-raw`. Design-token styling (Fraunces headings, Inter body, editorial line height, code blocks, scrollable tables, lazy images, safe external link rels). Demotes any Markdown H1 to H2.
- `src/routes/blog.index.tsx`:
  - Loader calls `listPublishedPosts` (SSR).
  - Eyebrow, H1 "Notes from Workshop", intro copy, featured most-recent card, responsive editorial grid. Intentional empty state.
  - `head()` with title/description/canonical/OG/Twitter/site_name; JSON-LD `Blog` with `ItemList` of visible posts.
- `src/routes/blog.$slug.tsx`:
  - Loader fetches full post; missing → `notFound()` (real 404). Never leaks draft existence.
  - SSR-rendered body (no client-only loading shell).
  - Layout: Back to Blog, dates, H1, deck, byline, cover (with alt), narrow column, `BlogPostBody`, share/copy-link (reuse existing sharing primitive if present), up to 3 related, restrained "Join Workshop" panel → `/signup` (auth-aware: hide for signed-in).
  - `head()` builds effective title/description, canonical, OG (`article`), Twitter, `article:published_time`/`modified_time`, og:image + og:image:alt when cover exists.
  - JSON-LD `BlogPosting` + `BreadcrumbList` (Workshop → Blog → title). No dependency on `useDocumentMeta`.

---

### Wave 4 — Navigation & footer

- **Desktop nav**: keep the 5 primary links. Add Radix dropdown "More ▾" after Gallery containing **Blog** and **Pricing**. Visible to all visitors.
- **Mobile bottom nav**: unchanged.
- **Mobile overflow**: refactor `SettingsMenuButton` into an always-visible menu control (rename icon/label to a generic menu; keep the current control — no extra icon).
  - Anonymous: Gallery, Events, Blog, Pricing, Sign in, Join Workshop.
  - Authenticated: preserve all current identity / Your stuff / referral / settings / sign-out entries; add Blog + Pricing under Explore.
- **Shared footer** `src/components/site-footer.tsx`:
  - Rendered from `src/routes/__root.tsx` after `<Outlet />`. Root wrapper becomes `flex flex-col min-h-screen` with `<main class="flex-1">` so footer sits at bottom on short pages.
  - Conversion block ("Make something with people." / supporting copy). Anonymous → `Join Workshop` → `/signup`. Authenticated → `Go to your profile` → `/me`.
  - Useful links use only real routes: Lounge, Groups, Collabs, Events, Gallery, Blog, Pricing.
  - Newsletter form: email + hidden honeypot + Subscribe; posts to `subscribeToNewsletter`; toast generic success/failure.
  - **Route awareness centralized in `SiteFooter`**: reads current route via `useMatches` and returns `null` on `/admin/*`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/onboarding`, `/checkout*`, `/dms/*`, `/lounge/$id`, `/workshops/$slug`, `/workshops/$slug/tools/*`, `/w/$token`, `/e/$code`, `/.lovable/*`, `/.well-known/*`, `/.mcp/*`, `/redeem/*`, `/goodbye`. Bottom padding on mobile so bottom nav never covers footer controls.

---

### Wave 5 — SEO & regression QA

- Update `src/routes/sitemap[.]xml.ts`: add `/blog` static entry; add published `blog_posts` as `/blog/{slug}` with `updated_at` as `lastmod`. Exclude drafts and `/admin/blog`.
- Update `public/llms.txt`: add Blog to Primitives + Pages + URL patterns (`/blog`, `/blog/{slug}`).
- `robots.txt` unchanged (already disallows `/admin`).
- QA: run production build; curl `/blog` and a published `/blog/{slug}` to confirm SSR HTML contains title/meta/JSON-LD/body; curl draft slug → 404; confirm anon cannot call admin server fns; smoke-test Lounge, Groups, Collabs, Events, Gallery, profile, Work, signup, admin.

---

### Technical notes

- No new npm deps. Uses `react-markdown` + `remark-gfm` already installed.
- All server fns use the current validator API (not `.inputValidator()` where deprecated).
- `supabaseAdmin` imported **inside handlers** in `*.functions.ts` per project rules; every admin fn re-asserts `has_role(...,'admin')` via `context.supabase` before any privileged work.
- Slug immutability enforced in DB trigger (source of truth) AND server fn (fast error).
- Public loaders always filter `status='published' AND published_at <= now()` — never rely on RLS alone in code.
- `route.head()` for all blog metadata (SSR); `useDocumentMeta` not used for crawler-critical fields.
- No changes to `src/routeTree.gen.ts` — added route files let the generator update it.

### Deferred (intentionally not built)

Scheduled publishing, categories/tags/archives, comments, revisions, multi-author, page-builder blocks, raw HTML, email sending, blog analytics, homepage article rail, Privacy/Terms/About/Contact footer links (routes don't exist).

### Deliverables at end

Migration name, files added/changed, new routes, RLS policies, server functions, SEO output verified, build result, and any deferred items.
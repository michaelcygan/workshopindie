# Blog categories — staged build

Give the Blog one editorial category per post, drawn from the same medium families as Works, with **General** as a zero-friction default. Categories improve discovery; they never block publishing.

Categories (stored slug): General `general`, Music `music`, Film & Video `film-video`, Writing `writing`, Visual Art `visual-art`, Games & Tech `games-tech`. "All" is a navigation state only, never stored.

## What I confirmed in the repo first

- `src/lib/taxonomy.ts` already owns canonical normalization (`LEGACY_TO_CANONICAL` maps `film→film_video`, `visual→visual_art`, `build→games_tech`, `writing_book→writing`). The new Blog model will reuse it, not duplicate it.
- Blog reads use **explicit field lists**, so the DB column alone is not enough. The ones that must change: `DASHBOARD_FIELDS` and `EDITOR_FIELDS` in `src/lib/blog-member.server.ts`, and the hand-written selects in `src/lib/blog.server.ts` (public list, single post, related, profile list, admin list, `select("*")` admin get), `src/lib/home.server.ts` (member blog rail + public blog cards), `src/routes/blog.rss[.]xml.ts`, `src/routes/sitemap[.]xml.ts`.
- Other `blog_posts` touch points that do **not** need the column: `src/routes/api/public/og.ts`, `src/lib/mention-suggestions.ts`, `src/lib/admin-users.functions.ts`, `src/lib/blog-entity-tags.*`, `src/components/home-pulse-rail.tsx` (draft nudges).
- The Postgres `category` enum is shared by Works/Collabs/Groups/Profiles. It will not be touched.

## Wave 1 — Data foundation

**Migration**
- `blog_posts.category_slug text NOT NULL DEFAULT 'general'` + named check constraint listing the six slugs.
- `blog_posts_category_published_idx (category_slug, published_at DESC, id DESC) WHERE status='published' AND show_in_blog_index=true`.
- Set-based backfill: for each post, resolve connected Works via `blog_post_entity_tags` → `works.category`, normalize with the legacy map, and assign only when every connected Work agrees. No Works or mixed Works → stays `general`.

**Shared model** — new `src/lib/blog-categories.ts` (client-safe): `BLOG_CATEGORIES` (slug, label, editorial description, associated canonical Work category), `BLOG_CATEGORY_SLUGS`, `BlogCategorySlug`, `isBlogCategorySlug()`, `getBlogCategory()`, `blogCategoryFromWorkCategory()` built on `taxonomy.ts` normalization.

**Types & selects** — add `category_slug` to the generated Supabase types and to every model above: `BlogWrite`, `DASHBOARD_FIELDS`, `EDITOR_FIELDS`, `BlogEditorInitial`, member `EditorPost`/`Post`, `BlogListItem`, `HomeBlogCard`, `PublicBlogCard`, home blog row types.

*Checkpoint:* production build clean; every post has a valid category.

## Wave 2 — Publishing flows

- **Server writes:** member and admin Zod validators accept only allowlisted slugs; create/update handlers and return types carry it. New drafts default to `general`. Category is editable before and after publish and never affects the article slug. No moderation on the value. Optimistic concurrency, quotas, rate limits, excerpts, slugs, visibility, attribution, Connections, publish/unpublish behavior all preserved.
- **Work-seeded drafts:** in `createMyBlogDraftServer`, a genuinely new draft with a seed Work inherits that Work's normalized category. A **reused** draft is never recategorized (same protection as reused starter copy). Connecting a Work later never silently recategorizes.
- **Member editor** (`src/routes/me.blog.$id.tsx`): category state from the loaded post, included in saves, marks dirty on change. Compact single Select below the title, before cover/Connections, visibly defaulting to General, hint "Choose the closest medium. General is always fine." Shown in Preview; keyboard accessible.
- **Admin editor** (`src/components/blog-editor.tsx`): same field on new and existing posts, included in `buildPayload()`, shown in Preview; all existing behavior untouched.
- **Dashboards:** `/me/blog` and `/admin/blog` show a small category label; `/admin/blog` gains a category filter alongside Type/Status/Visibility/Connections. No redesign.

*Checkpoint:* generic draft = General; Work-seeded draft inherits; reused draft unchanged; `writing_book`→Writing; both editors save; URL unchanged on recategorize; build passes.

## Wave 3 — Public discovery

- **Route:** `src/routes/blog.category.$category.tsx` → `/blog/category/<slug>` (kept off `/blog/$slug` to avoid slug ambiguity).
- **Server query:** dedicated public archive fetcher — validates the slug, filters `category_slug`, `status='published'`, `show_in_blog_index=true`, excludes future posts, orders `published_at DESC, id DESC`, ~24 per page with `?page=n` and pagination metadata. Existing public-client and cache conventions. Unknown slug → real 404; out-of-range page does not silently repeat page one.
- **Design:** "Blog" overline, category name as H1, description from `blog-categories.ts`, quiet archive context, existing editorial card language, prev/next pagination, polished empty state. Reuse/extract from `blog-editorial-sections.tsx` rather than copying the index route.
- **Nav:** slim `All · Music · Film & Video · Writing · Visual Art · Games & Tech · General` strip under the `/blog` masthead; active state clear; horizontal scroll on mobile; restrained black-and-white treatment.
- **Cards:** quiet category micro-label on featured, latest, more-stories, logged-out homepage stories, member-home blog rail, and member dashboard. Non-interactive inside full-card links — no nested anchors.
- **Article page** (`/blog/$slug`): category as a linked overline above date/title → category route; `article:section` meta; `articleSection` in BlogPosting JSON-LD; breadcrumbs (visible + structured) become Workshop → Blog → Category → Article. URLs unchanged.
- **Related stories:** entity overlap stays strongest, then same-category indexed posts, then general recent — existing exclusions preserved.

*Checkpoint:* six URLs, invalid slug, empty category, page two, draft/hidden/future exclusion, article link + metadata, homepage cards, mobile nav, build.

## Wave 4 — Distribution, SEO, audit

- RSS: add `<category>` with the human label. No per-category feeds.
- Sitemap: include category pages only where at least one published, indexed post exists (derive from the existing post query selecting `category_slug`).
- Visibility contract: `show_in_blog_index = false` posts keep their category internally but stay out of `/blog`, category pages, RSS, homepage, and all category discovery, while remaining reachable at their direct URL. Caching unchanged.
- Final audit: every `.from("blog_posts")` reviewed, no unvalidated category writes, `public.category` enum untouched, route tree contains the new route, lint + production build, pre-existing warnings reported separately from new errors.

## Non-goals

Multiple categories, free-form tags, user-created or admin-managed categories, category subscriptions or feeds, a new recommendation engine, a new Blog table, Work category storage changes, quota/plan changes, a TanStack validator refactor, or visual work outside the category surfaces.

If the scope runs long I stop only at a completed checkpoint and report what is done, what was verified, and which wave is next.

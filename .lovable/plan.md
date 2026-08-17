# Blog Topics, Mediums, and feed hubs

Give the Blog Medium-grade information architecture on top of Workshop's existing cream editorial design: a canonical **Topic** layer, **Medium** hubs backed by existing Fields, four server-backed feeds, and scalable filters — without breaking any existing data or URL.

The plan file also lands at `.lovable/plan/blog-topics-medium-feed-hubs-2026-08-16.md` for the record.

## What exists today (verified)

- `/blog` loads every published post through `listPublishedPosts()` and filters entirely client-side in `blog-filters.ts` — that is what has to become server-backed.
- Classification is `category_slug` + `fields[]` + `subjects[]` + `story_type`, resolved through `blog-form.ts` / `blog-story-types.ts`. `blog-select.ts` centralizes columns.
- `src/lib/taxonomy.ts` exports `TOPICS` / `isTopic`, but those values are gathering formats (Critique, Open Mic, Jam…) — a naming collision to resolve. Only `taxonomy.ts` and `categories.ts` reference them.
- `blog_post_entity_tags` is already the single relationship system; `EntityBlogPosts` already handles reciprocal rails.

## Phases

### 1. Naming collision
Rename `TOPICS` → `GATHERING_TYPES`, `isTopic` → `isGatheringType` in `taxonomy.ts`, migrate the `categories.ts` call sites, keep deprecated aliases, and change any user-facing "Topic" label on those values to "Format".

### 2. Migration (additive, one migration)
- `topics` — slug, canonical name (case-insensitive unique), short_description, about_markdown, aliases, status (active/merged), merged_into_topic_id, featured, created_by, timestamps.
- Join tables `blog_post_topics`, `work_topics`, `group_topics`, `collab_post_topics`, `group_event_topics` — entity id, topic id, `sort_order` (0 = primary), timestamps.
- `topic_follows` and `medium_follows` — user id, target, unique pair.
- `mediums` metadata table keyed to canonical `FieldId` (slug, short description, about copy, featured), seeded from `FIELD_IDS`.
- Backfill canonical Topics from distinct `blog_posts.subjects` and `works.subjects`, normalized and deduped, preserving display text and order; write the join rows.
- GRANTs on every new table, RLS: public read of active topics/mediums, users manage only their own follows, entity owners manage assignments through existing ownership checks, admins manage canonical records.
- Indexes for slugs, join lookups, follow lookups, and feed ordering (`published_at, id`).
- No column is renamed or dropped; legacy arrays stay authoritative fallbacks and are kept in sync on write.

### 3. Server layer
New `src/lib/topics.ts` (pure normalization/slug/alias helpers), `src/lib/topics.server.ts`, `src/lib/topics.functions.ts`, plus feed functions in `blog.server.ts` / `blog.functions.ts`:
- `listBlogFeed({ view, topic, medium, postType, cursor })` for `for-you | following | featured | latest`, cursor-paginated, deduplicated server-side, always filtered by published status, `published_at <= now()`, and `show_in_blog_index`.
- For You ranking (deterministic, SQL-scored): topic match > followed author > medium match > joined group > featured boost > recency tiebreak. No signals → featured/latest fallback flagged as a fallback.
- Topic/Medium search + counts, topic & medium detail with contextual modules, follow/unfollow, viewer follow state, ordered topic assignment writes.
- Viewer identity comes from `requireSupabaseAuth` context only; batched author/relationship loads, no N+1.

### 4. Blog home
- Keep the masthead and `BlogMastheadActions`; broaden the description copy.
- New `BlogFeedNav`: **For You · Following · Featured · Latest**, `view=` in URL, aria-current, signed-out clicks on the personalized tabs open `SignupGateModal` with the existing replay-after-auth behavior; Featured is the signed-out default, For You the signed-in default.
- New `BlogFilterBar`: Topic (searchable combobox) · Medium (searchable combobox) · More filters (Post type, from `BLOG_STORY_TYPES`) · Clear. Popovers on desktop, sheet on mobile. Single-select in v1. URL state, legacy `field`/`subject` params normalized to `medium`/`topic`.
- Single understated "Load more". Existing `/blog/category/$category` and `/blog/c/$field` routes keep working.

### 5. Hub pages
`/topics`, `/topics/$slug`, `/mediums`, `/mediums/$slug` — restrained searchable directories plus detail pages with **Blog · About** tabs only. Blog dominates: lead story, remaining posts, Medium/Post-type (or Topic/Post-type) filter, Load more; then Related Work, Groups (`GroupCardCompact`), Latest Collabs, and Events only when explicitly associated. Empty modules render nothing. Medium pages surface the existing system Medium Group when one exists. Merged topics 301 to their canonical slug.

### 6. Cards, article, authoring
- Card eyebrow becomes `POST TYPE · PRIMARY TOPIC` (falls back to primary Medium), with Topic → `/topics/$slug`, Medium → `/mediums/$slug`, Post type → existing category route.
- `blog.$slug.tsx` keeps its layout, author handling, comments, and noindex rules; JSON-LD keywords/about/mentions switch to canonical Topics, Mediums, and linked entities.
- `BlogPostContext` order: Post type → Category → Medium(s) → Topic(s) → Related Work → People → Collabs → Groups/location → Events → Related posts, with Follow-Topic / Explore-Medium next actions.
- `BlogAboutEditor` is refactored (not replaced): one Post type, up to 3 Mediums with a starred lead, up to 5 Topics with the first leading, then the existing entity-tag picker and preview. Visible "Subject(s)" labels become "Topic(s)" across Blog and Work authoring.
- Shared Topic picker added into the existing taxonomy sections of Work, Group, Collab, and Group Event edit flows — no redesigns.

### 7. Follow buttons
`TopicFollowButton` / `MediumFollowButton` mirroring `FollowButton`'s look and gate/replay behavior, writing to the new follow tables (never `follows`). Follow state invalidates the For You / Following query keys so the feed updates without a refresh.

### 8. SEO
Unique title/description/canonical/OG per hub route, `CollectionPage` + `DefinedTerm` + breadcrumb JSON-LD, active hubs with public content added to `sitemap.xml`, merged slugs excluded.

## Verification

Unit tests: topic normalization/alias/slug/dedupe, backfill ordering, legacy subject/field fallback reads, legacy URL param compatibility, all four feed modes, signed-out gating, Following dedupe, For You fallback, filter combinations, follow authorization, draft/hidden/scheduled exclusion, merged-topic redirect, empty-module behavior, and the Process Note example classification. Then typecheck, tests, lint, build, and responsive QA at desktop and mobile for the signed-out Blog, no-follow user, followed-topic user, both hub tab sets, filtering, follow-after-signup, authoring, and article context.

Out of scope this pass: recommendation ML, text inference, notifications, claps, paywalls, publications, bookmarks.

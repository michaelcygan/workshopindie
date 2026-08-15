# Blog taxonomy — public surfaces (second half)

The data model, editors, and server reads are done. This pass finishes everything readers see: the article eyebrow, "About this post", the five-Category navigation and listing route, filters, RSS/structured data, and tests.

## What changes for readers

- Blog navigation becomes **All · Essays · Interviews · Field Notes · Resources · Announcements** instead of the 13-Field rail.
- Every Blog card and the article eyebrow read **POST TYPE · LEAD SUBJECT**, falling back to primary Field, then Post type alone, then nothing.
- "About this post" lists **Post type, Category, Fields, Subjects**, then only the linked items that exist (Works, People, Collabs, Groups, Events, Related posts). The derived **Medium** row is removed. It renders even when a post has no linked entities, as long as it has taxonomy.
- Category pages get shareable filters for Post type, Field, and Subject in the URL.
- Old `/blog/c/<field>` links keep working and keep their current behaviour; untyped legacy posts still appear under All.

## Technical plan

### Shared eyebrow
- Add `blogEyebrow(row)` to `src/lib/blog-form.ts` (client-safe): resolves Post type via `resolvePostType`, lead Subject from `subjects[0]`, primary Field from `fields[0]`; returns `"POST TYPE · LEAD SUBJECT"` with the documented fallbacks. Single source used by every card and the article header.
- `toBlogCard` in `src/components/blog/blog-editorial-sections.tsx` gains `eyebrow`, `storyType`, `subjects`, `fields`; `PublicBlogCard` in `src/lib/home-types.ts` gains the optional `eyebrow` field. Cards render `eyebrow` where they currently render category/field text.

### Surfaces that switch to the shared eyebrow
`blog.index.tsx`, the new category route, `blog-featured-carousel.tsx`, `public-featured-stories.tsx`, `blog-editorial-sections.tsx` (latest/more/archive), `home-featured-blog.tsx` and home rails, Member Home, profile Blog tab, `entity-blog-posts.tsx`, `blog-post-peek.tsx`, and `blog.rss[.]xml.ts` (category term in the feed).

### About this post
- `src/lib/blog-post-context.ts`: drop `mediums` and `normalizeMedium`; add `postType` (label), `section` (derived Category), `fields`, `subjects`. `hasContext` becomes true when there is taxonomy *or* any linked entity. Inputs gain `storyType`, `storyTypes`, `fields`, `subjects`.
- `src/components/blog-post-context.tsx`: rows ordered Post type → Category → Fields → Subjects → Works → People → Collabs → Groups → Events → Related posts. Category links to the new `/blog/category/$category`. Remove the Medium row. `WorkEntry` meta uses the `eyebrow` already supplied by `blog-entity-tags.server.ts` instead of `subtype + categories`.
- `src/routes/blog.$slug.tsx`: pass the new taxonomy fields into `deriveBlogPostContext`, switch the article header eyebrow to `blogEyebrow`, and extend the `BlogPosting` JSON-LD with `articleSection` (derived Category) and `keywords` (Subjects + Fields). `mentions` stays as-is.

### Navigation and the Category route
- `src/components/blog/blog-category-nav.tsx`: render All + the five `BLOG_SECTIONS`, linking to `/blog/category/$category`. Keeps its current chip styling.
- New `src/routes/blog.category.$category.tsx`: validates the section id, loads via the existing server-side `listPostsBySectionServer` (exposed through a `listPostsBySection` server function in `src/lib/blog.functions.ts`), and reuses the masthead + featured/latest/more/archive layout from the index route. Own `head()` with section label/description, canonical, og/twitter tags, `notFoundComponent`.
- URL filters `?type=&field=&subject=` are read with `validateSearch` and applied to the loaded section rows; a compact filter bar sits under the nav on both `/blog` and the category route, with active chips clearable.
- `src/routes/blog.c.$category.tsx` is left untouched so legacy Field URLs keep resolving.

### Tests
New `src/lib/blog-eyebrow.test.ts` and updates to `src/lib/blog-post-context.test.ts` covering: eyebrow fallback chain; exhaustive Post type → single Category mapping; legacy `story_types` hydration; About-this-post with taxonomy and zero entities; no Medium derivation; connected Work eyebrow; section filtering including untyped posts under All. Then typecheck, full test run, and a production build.

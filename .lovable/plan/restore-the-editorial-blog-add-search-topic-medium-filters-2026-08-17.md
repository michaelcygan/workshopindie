# Restore the editorial blog, add search + Topic/Medium filters

Bring `/blog` back to the old editorial layout (Featured story lead, Latest stories, Keep reading, Every story) and put a single, clean control row above it.

## The page, top to bottom

1. Masthead — "Blog / Notes from Workshop" with the description and the My posts / New post actions (unchanged).
2. One control row:
   - Search bar with a live dropdown of matching posts. Typing shows up to 8 post suggestions (cover thumb, title, post type · date); choosing one opens that post. Enter opens the top match. Keyboard up/down/escape supported.
   - Topic and Medium filter buttons to the right of the search, plus an "x" Clear button that appears only when something is selected.
3. Featured story — the big lead + right-hand list, as before.
4. Latest stories, Keep reading, and Every story archive bands.

## What gets removed

- The "General / Essays / Process Notes / Interviews" category rail.
- The Field chip row (Environment & Nature, Film & Video, …) — the bottom row crossed out in the screenshot.
- The four feed tabs (For you, Following, Featured, Latest) on `/blog`.
- The "All post types" select is folded away; Topic and Medium are the two filters.

Nothing changes for individual posts, authoring, or the dedicated category pages (`/blog/category/...`), which keep their own rail.

## Filtering behavior

- Topic and Medium selections live in the URL (`/blog?topic=chicago&medium=film_video`), so filtered views are shareable and survive refresh/back.
- Filters narrow the whole page: the featured lead, Latest, Keep reading, and Archive all shrink together, with the existing empty state when nothing matches.
- Clear resets both.

## Technical notes

- `src/routes/blog.index.tsx`: keep `validateSearch` for `topic`/`medium` (drop `tab`/`type`), load a larger single feed (`blogFeed` with `tab: "latest"`, limit ~60) plus featured, map rows with `toBlogCard`, and split into featured / latest (next 5) / more (next 6) / archive (rest). Render `BlogLatestStories`, `BlogMoreStories`, `BlogArchive` from `blog-editorial-sections.tsx` and `PublicFeaturedStories` for the lead. Remove `BlogFeedNav`, `BlogFeedList`, and `blogFeedPersonal` usage.
- New `src/components/blog/blog-search.tsx`: debounced input, dropdown built on the existing popover/command primitives, styled with the blog's editorial tokens.
- New server fn `searchBlogPosts` in `src/lib/blog-search.functions.ts`: published posts only, `ilike` on title/excerpt, returns id, slug, title, cover, eyebrow fields, date; limit 8. Uses `BLOG_RAIL_COLUMNS` from `src/lib/blog-select.ts`.
- Topic options continue to derive from loaded posts; Medium options from `MEDIUM_LIST`. Both render as compact pill dropdowns rather than raw selects.
- Head metadata stays canonical to `/blog`.

# Filter the blog index by Field and Subject

Right now the blog front page (`/blog`) only offers the five category chips (All, Essays, Interviews, Field Notes, Resources, Announcements). The category pages already have a working Type · Field · Subject filter bar — the front page just never got it.

## What changes

Add the same filter bar to `/blog`, directly under the category chips:

- **Type** — Essay, Interview, Process note, etc.
- **Field** — the 13 canonical Fields (this is what used to be called "Medium").
- **Subject** — the free-form subjects authors tag on a post.

Behavior, matching the category pages exactly:

- Options are built from the posts actually on the page, so no dead filters ever appear.
- A group with fewer than two options hides itself.
- Selections live in the URL (`/blog?field=film_video&subject=chicago`), so a filtered view is shareable and survives refresh/back.
- Tapping an active chip clears it; a "Clear" link resets everything.
- Filters apply to the whole page — featured lead, Latest, More, and Archive all narrow together, with the existing "Nothing here yet" empty state when a combination has no matches.
- Chip rows scroll horizontally on mobile with no page overflow.

Nothing about posts, authoring, categories, or article pages changes.

## Technical notes

- `src/routes/blog.index.tsx`: add `validateSearch` for `type`/`field`/`subject` (plain strings, no enums), classify loaded posts with `resolveBlogClassification`, derive options, filter before the featured/latest/more/archive split, and render `<BlogFilterBar />` after `<BlogCategoryNav />`.
- Reuse `src/components/blog/blog-filter-bar.tsx` and the option-derivation logic from `src/routes/blog.category.$category.tsx` as-is; to avoid a second copy, lift the shared `deriveBlogFilterOptions` + `applyBlogFilters` helpers into `src/lib/blog-form.ts` and have both routes call them.
- Head metadata stays canonical to `/blog` so filtered permutations don't create duplicate indexable URLs.

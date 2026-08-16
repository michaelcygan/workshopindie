# Blog filters: General, Featured, Process notes, Field, Subject

Drop the "Type" filter — how a post is formatted isn't what readers browse by. The blog's top row becomes one coherent control strip.

## The new filter row on /blog

Replacing the five category chips at the top of the blog:

- **General** — everything, the default.
- **Featured** — only posts the team has featured.
- **Process notes** — only posts whose type is Process note.
- **Filter by field** — dropdown of the canonical Fields present in the posts.
- **Filter by subject** — dropdown of the subjects authors tagged.

Behavior:

- General / Featured / Process notes act as one exclusive group (pick one).
- Field and Subject are independent and combine with whichever of the three is active.
- Options are derived from the posts actually loaded, so no dead options.
- Selections live in the URL (`/blog?view=process&field=film_video&subject=chicago`) so a view is shareable and survives refresh/back.
- Tapping an active chip or picking the same option again clears it; a "Clear" link resets everything.
- Filters narrow the whole page — lead, Latest, More, Archive — with the existing empty state when nothing matches.
- Row scrolls horizontally on mobile, no page overflow. Keyboard-operable, clear focus states.

Interviews stay reachable through the existing `/blog/category/interviews` page; they just aren't a top-level chip.

## Technical notes

- `src/routes/blog.index.tsx`: add `validateSearch` for `view` (`all` | `featured` | `process`), `field`, `subject` as plain strings with `fallback`. Classify posts with `resolveBlogClassification`, derive Field/Subject options, apply filters before the featured/latest/more/archive split.
- Rework `src/components/blog/blog-filter-bar.tsx`: remove the `types` group, add the exclusive `view` segment (General / Featured / Process notes) ahead of the Field and Subject dropdowns. Keep the existing chip/dropdown styling.
- `src/routes/blog.category.$category.tsx` already uses the bar — update it to the new prop shape and keep Field/Subject there (no view segment, since the category already scopes it).
- Replace `<BlogCategoryNav>` on the index with the new bar; leave the category routes and nav component itself intact for the category pages.
- Head metadata stays canonical to `/blog` so filtered permutations aren't separately indexed.

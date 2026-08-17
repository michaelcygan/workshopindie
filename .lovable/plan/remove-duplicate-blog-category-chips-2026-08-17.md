# Remove duplicate blog category chips

The "General / Essays / Process Notes / Interviews" chip rail on /blog duplicates what the "All post types" dropdown already does.

## Change

- Remove the chip rail from the main blog index (/blog), leaving the tabs (For you, Following, Featured, Latest) directly above the topic / medium / post-type filter row.
- Keep the dedicated category pages reachable by URL; they keep their own rail so readers landing there can move between sections.

## Technical

- `src/routes/blog.index.tsx`: drop the `BlogCategoryNav` render and its import.
- `src/components/blog/blog-category-nav.tsx` stays in place for `blog.category.$category.tsx` and `blog.c.$category.tsx`.

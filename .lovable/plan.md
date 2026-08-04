# Tighter homepage header with three featured stories

Two changes to the logged-out homepage top area: reclaim vertical space, and turn the single featured story into a three-story block.

## 1. Tighter masthead

- Reduce masthead padding (`py-8 / md:py-10` down to roughly `py-6 / md:py-7`) and trim the gaps between eyebrow, headline, and subline.
- Slightly reduce the headline size on desktop so the fold shows more content while keeping the same editorial weight.
- Reduce the featured section's own top/bottom padding to match, so the header and feature read as one compact band.

## 2. Three featured stories

New layout for the featured block:

```text
+---------------------------+   FEATURED STORY
|                           |   Big headline (lead story)
|      large cover 16:10    |   Short excerpt (clamped to 2-3 lines)
|                           |   Author - Date
|                           |   ------------------------------------
+---------------------------+   [thumb] Second story headline
                                [thumb] Third story headline
```

- Lead story keeps the large image; its title, excerpt, and byline move up to sit at the top of the right column instead of vertically centered.
- Below the lead text, two secondary stories render as compact rows: small square thumbnail plus headline (with date), each a full clickable link.
- Secondary stories with no cover image fall back to the existing Workshop placeholder treatment.
- On mobile the three stack: big image and lead text first, then the two compact rows.

## Data and behavior

- Sources the three from the existing `featuredPosts` in the current `getPublicHome` payload; if fewer than three featured posts exist, fill from `latestPosts` (excluding duplicates). No new server function or query.
- The existing auto-rotating carousel of featured stories is replaced by this static three-up block, since all three are now visible and clickable at once. Prev/next arrows and dots are removed.
- `PublicLatestStories` below de-duplicates any post already shown in the header so the same story doesn't appear twice.

## Technical notes

- Edits scoped to `src/components/home/public-featured-stories.tsx` (rewrite the layout, drop rotation state) and `src/components/home/public-home.tsx` (masthead spacing, pass a de-duped list down).
- No token, schema, or server changes.

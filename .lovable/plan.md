# Neutral category placeholder thumbnails

The homepage Open Calls thumbnails currently render each category label on its category tint — the "Music" cards come out lavender/purple, and other categories get their own colored washes. That fights the black-and-white, industrial direction of the rest of the site.

## Change

Make the placeholder monochrome everywhere it appears:

- Drop the per-category color tint entirely.
- Background: a light neutral surface (the existing muted-surface token), with the same hairline border as today.
- Label: the muted ink token, keeping the current display face, size, and tight tracking.
- Same treatment for every category, not just Music — there's a single shared placeholder component, so one change covers all of them.

Everything else stays as it is: same square/rounded shape, same sizing, same layout position, category label still shown.

## Technical notes

- Only file touched: `src/components/home/category-placeholder.tsx` (used by `src/components/home/public-open-collabs.tsx`).
- Removes the `categoryClass(category)` tint call; uses semantic neutral tokens (`bg-surface-2`, `text-ink-muted`) rather than hardcoded colors.
- Category color tokens remain available for other surfaces that still use them.

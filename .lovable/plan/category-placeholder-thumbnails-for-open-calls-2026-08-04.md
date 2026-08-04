# Category placeholder thumbnails for Open Calls

Collabs on the logged-out homepage have no cover image, so the Open Calls list is text-only. Every Collab does have a category, so each row gets a small generated thumbnail showing the category word set in the brand display font on a brand-tinted surface.

## What it looks like

- Each Open Calls row becomes a two-column row: a compact square/4:3 thumbnail on the left, the existing text block on the right.
- The thumbnail is pure CSS + text — no image files. Category label in the display serif, centered, on a soft tinted panel derived from the existing per-category color tokens, with a thin border matching the editorial rules already used on the page.
- Mobile: thumbnail ~64px, sitting left of the title block. Desktop: ~96px. Text alignment and spacing stay as they are today.
- If a Collab ever does have a cover image, the image is used instead and the placeholder is the fallback.

## Technical notes

- New presentational component `src/components/home/category-placeholder.tsx`: takes a `Category` plus a size, renders the label via `CATEGORY_LABELS` and the tint via the existing `categoryClass` / `categoryClassFor` helpers from `src/lib/categories.ts` — no new colors, tokens only.
- `src/components/home/public-open-collabs.tsx`: wrap the row content in a flex row and render the placeholder before the text block. No data or server-function changes; `PublicCollabCall` already carries `category`.
- No changes to `home.server.ts` or `home-types.ts`.

## Out of scope

- Work cards (they already have real images).
- Uploading real Collab cover images.

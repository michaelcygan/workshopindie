## Fix Group Gallery: avatar clip + category filter

**File:** `src/routes/g.$slug.tsx` (`GroupWorkTab`)

### 1. Fix clipped avatar
The author avatar uses `-bottom-3` to overhang the cover image, but both the inner image container and the outer `<Link>` card set `overflow-hidden`, which clips it into a half-circle.

- Remove `overflow-hidden` from the outer card `<Link>`.
- Keep `overflow-hidden` on the inner `.h-32` image div so the hover zoom on the cover still clips correctly.
- Add matching `rounded-t-2xl` to the inner image div so the cover corners stay rounded now that the outer card no longer clips them.
- Bump avatar to `ring-2 ring-background` on a slightly larger `h-8 w-8` so it reads clearly once fully visible.

### 2. Add category filter
Add a "Category" filter next to the existing Recent/Trending sort and search icon.

- New state `category: Category | "all"` (default `"all"`).
- Render a `DropdownMenu` trigger showing the current label ("All" or the `CATEGORY_LABELS[category]`), listing "All" + one item per entry in `CATEGORY_LABELS` (Music, Book, Film, etc.).
- Only surface categories that are actually present in the loaded `works` list (dedupe from `works.map(w => w.category)`), so empty categories don't appear.
- Extend the `filtered` computation to also filter by `category` when not `"all"`.
- Update the empty-results message to mention the active category when applicable ("No Works match Music.").

### Out of scope
No schema, server-fn, or query changes — this is a pure client-side filter over the already-fetched list, matching the existing search/sort pattern.

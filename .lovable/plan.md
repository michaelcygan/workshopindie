## Group Gallery — richer cards + low-impact utility

Scope: only `GroupWorkTab` in `src/routes/g.$slug.tsx` (the "Gallery" tab). Everything else in the group page stays as-is.

### 1. Card overlays (context at a glance)
Update the query to also select `category` and the author profile (`author:profiles!works_author_id_fkey(username, display_name, avatar_url)`).

On each card:
- **Category chip** — top-right of the cover image, small pill (`CategoryChip` reused from collabs, `size="xs"` styling: bg `bg-black/55 text-white backdrop-blur`, text-[10px], rounded-full). Shows Film / Music / Book / etc.
- **Author avatar** — bottom-left of the cover image, overlapping the image/title divider by ~50%. 28px circle with white ring (`ring-2 ring-background`). Wrapped in its own `<Link to="/u/$username">` with `e.stopPropagation()` so it navigates to the profile instead of the work.
- Keep the existing title below. Add a second line under the title: small muted `by {display_name}` (text-xs text-ink-muted) so context reads even without hovering the avatar.

### 2. Low-impact utility strip
A single thin row directly under the "Add your Work" button, right-aligned, matching the mock's small marks in the top-right:

```
                                              [Sort ▾]  [🔎]
```

- **Sort dropdown** — shadcn `DropdownMenu` triggered by a ghost button showing the current sort (default "Recent"). Options: `Recent`, `Trending` (trending = simple client-side sort by `published_at` within last 30d, falls back to recent). Text-xs, no border, just a chevron.
- **Search icon** — icon-only ghost button; click expands inline into a small `Input` (200px) that filters the visible works by title (client-side `includes`, case-insensitive). Escape or blur-when-empty collapses it back to the icon. Scope label placeholder: `Search in {group.name}…`.

Both controls live in a `flex items-center gap-1` container, `text-ink-muted`, so they read as utility not UI weight.

### 3. Nice-to-haves included
- Empty-filter state: if search yields 0, show a one-line "No Works match "{query}"" with a Clear button — reuses `GroupEmpty` styling minimal variant.
- Hover: keep the existing `-translate-y-0.5 hover:shadow-lift`; add subtle `group-hover:scale-[1.02]` on the cover image via a wrapping `overflow-hidden` div (already present) for a bit of life without motion libs.
- Accessibility: avatar link gets `aria-label={`View ${author.display_name}'s profile`}`; chip is decorative (`aria-hidden`).

### Not in scope
- No schema changes; `category` and author fk already exist on `works`.
- No changes to Today / Collabs / Events / Members / About tabs.
- No changes to the shared `/gallery` route.

### Technical notes
- Reuse `CategoryChip` from `@/components/category-chip` (already used on collab page). If it doesn't accept overlay styling cleanly, render a plain `<span>` using `CATEGORY_LABELS[category]` from `@/lib/categories` to avoid coupling.
- Trending heuristic stays client-side for v1 (no new server function): sort by `published_at desc`, boost items with `published_at` within last 30d — good enough at 48-row cap; can be swapped for a real trending score later without UI changes.

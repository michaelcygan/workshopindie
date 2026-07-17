
## Goal
Modernize the desktop Today tab in `/g/$slug`, keep the chat composer above the fold on a MacBook-sized viewport, and always populate the sidebar with fresh signal (collabs + works). Reclaim vertical space in the group header. Mobile is intentionally out of scope for this pass.

## Changes

### 1. Header real estate (`src/components/group/group-hero.tsx`, header block in `src/routes/g.$slug.tsx`)
Reduce the hero's dominant vertical footprint on desktop:
- Shorten cover strip: from current tall banner to `h-28 md:h-32` (down from ~h-44/h-56).
- Collapse identity row: avatar tile shrinks (`h-16 w-16` on desktop), name drops one display size (e.g., `text-3xl md:text-4xl` instead of `text-5xl`), chips (CITY / Official) inline with name on desktop rather than stacked above.
- Move "Open the Lounge / Share / Joined" action cluster onto the same row as the name (right-aligned), removing the empty right rail.
- Member count moves inline as a small meta pill next to the chips.
- Tab bar stays sticky right under the header — no change to tab UX.

Net: hero shrinks by roughly ~120–160px on laptop, so the chat area sits higher.

### 2. Today tab layout (`src/components/group/group-today-tab.tsx`)
Rework the grid to be denser and always-populated:

```text
┌───────────────────────────────┬──────────────────────┐
│ Today in {group}              │ Next event           │
│ (chat scroller + composer)    │ Recent collabs (5)   │
│                               │ Recent works (5)     │
└───────────────────────────────┴──────────────────────┘
```

- Grid: `lg:grid-cols-[minmax(0,1fr)_300px]` (narrower rail; was 320px).
- Chat container height clamp tightened so composer is always above the fold on a 13" MacBook (viewport height ~735 CSS px):
  - `h-[clamp(240px,36vh,380px)] xl:h-[46vh]` (down from 42vh / 56vh).
  - Header row of the chat card padded down (`py-2.5`), meta text one line, remove the redundant "each message clears…" subtitle (move to a tooltip on the counter).
- Empty state for chat gets a smaller, less boxy treatment (single line, muted).

### 3. Remove Fresh Collabs pinning flow
- Delete the `FreshCollabs` component, `GroupTodayPinPicker` usage, `group_today_pins` queries, pin/unpin mutations, and the `Pin` button in the header of that card.
- Replace with a new **RecentCollabs** module: pure query against `group_collabs` → `collab_posts` where `status = 'open'`, ordered by `added_at desc`, limit 5. No auth-gated actions.
- Card is compact: title row + 5 rows of `{title · by author · category chip}`, each a link to `/collab/$slug`. Footer link: "See all collabs →" (switches to the `collab` tab via `navigate({ search: { t: 'collab' } })`).
- No DB changes. The `group_today_pins` table stays in place (unused); do not drop it in this pass.

Note: the pinning server logic and picker component remain in the codebase but unreferenced from the Today tab. Fine to leave for now; can be swept in a follow-up.

### 4. New "Recent works" module (new component `RecentGroupWorks` inside `group-today-tab.tsx` or its own file)
- Query `group_works` join `works` where the work is published/public, order by `added_at desc`, limit 5.
- Compact row layout: 40px square thumbnail (rounded-lg), title, author display name, category chip. Link to `/works/$slug`.
- Footer link: "See all works →" (switches to the `work` tab).
- Empty state (rare, since sidebar should always populate): muted single line "No works tagged yet." Only shown if the group truly has zero tagged works.

### 5. Sidebar visual polish (2026–2027 direction)
- Replace heavy `rounded-3xl border` cards with lighter `rounded-2xl` + `border-border/60` and reduced padding (`p-3.5`).
- Section titles switch from `font-display text-base` to `text-[13px] font-medium uppercase tracking-wide text-ink-muted` for a modern "quiet label" hierarchy.
- Row hover uses `bg-muted/40` instead of full borders; tighter 8px row gaps; no icons in row bodies (icon only in section title).
- Chat card gets a subtle `bg-surface` inner + no border between header and scroller (single continuous surface).

### 6. Behavior invariants
- Chat container height stays fixed regardless of pinned/unpinned state (no more pinning, so this is trivially satisfied).
- Composer visible on 1280×735 without page scroll (verified with element screenshot via Playwright after build).
- Sidebar modules render for logged-out visitors too (read-only), preserving "always has information".

## Files touched
- `src/components/group/group-hero.tsx` — header density.
- `src/routes/g.$slug.tsx` — minor: pass `navigate` handler for "See all" links if needed; tighten hero wrapper spacing.
- `src/components/group/group-today-tab.tsx` — remove `FreshCollabs` + pin flow, add `RecentCollabs` + `RecentGroupWorks`, tighten chat height clamp, restyle sidebar cards.
- No DB migration, no server-function changes.

## Out of scope
- Mobile Today layout (explicitly a later pass).
- Deleting the `group_today_pins` table or `GroupTodayPinPicker` component.
- Changes to other tabs (Collabs, Gallery, Events, Members, About).

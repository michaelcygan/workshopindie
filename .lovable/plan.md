Two small, presentation-only tweaks to `src/routes/u.$username.tsx`, mobile-only (`< md`). Desktop, data, and filter logic are unchanged.

## 1. Category tiles — legible label on a pill

Current: black `Film` / `Music` heading text sits directly on the cover image and disappears against bright/light imagery. The "N pieces" chip on the right already reads well.

Change (inside the existing `showMobileTiles` block, around lines 858–863):
- Wrap the category label in a pill styled like the count chip — dark translucent background + white text — so it stays readable over any cover:
  - Pill: `rounded-full bg-ink/70 text-background backdrop-blur px-3 py-1 font-display text-lg` (matches the "2 pieces" chip aesthetic, slightly larger for hierarchy).
  - Keep the existing bottom gradient overlay for extra safety.
  - Keep the count pill on the right unchanged.
- No change to fallback (no-cover) tiles beyond swapping the label pill — the category color background still shows through around it.

## 2. Header identity block — fill the gap under `@handle · Chicago`

Currently on mobile the space directly under `@michaelcygan · Chicago` is empty; `LinkPills`, `headline`, `bio`, `aliases`, and `artist_statement` are either hidden on mobile or pushed far below.

Change (mobile only, `md:hidden` block inserted after line 566 and existing pieces re-scoped):
- Show `profile.headline` on mobile too (drop the implicit desktop-only styling; keep `text-ink-soft text-sm mt-1`).
- Move the existing mobile `LinkPills` (currently at line 590) up directly under the handle/city row so IG + external links sit inline with identity.
- Show `profile.bio` on mobile as a compact 3-line clamp under the pills (`mt-2 text-sm text-ink-soft line-clamp-3`) — desktop copy stays where it is via `md:hidden`.
- Show `profile.aliases` on mobile as tiny chips (same visual as the desktop `md:flex` row, but with `flex` on mobile).
- Keep the `artist_statement` blockquote where it already sits (above the tab bar) — it's the pull-quote, not identity metadata.

Net effect: the empty ring in screenshot 2 fills with IG/link pills → bio → aliases (whichever the user has filled in), matching a normal artist bio card.

## 3. Swipeable medium chip row + column list (replaces mobile tiles-only default)

Currently on mobile: when `activeCat === "all"`, the user sees stacked tiles and no way to pick a medium without tapping into one. The desktop chip strip is `hidden md:flex`.

Change inside `WorksTab`:
- Render a new mobile-only chip row above the content area (always visible on mobile when `availableCats.length > 0`), reusing the existing `CategoryScroller` component (`src/components/category-scroller.tsx`) which already handles horizontal scroll + drag + auto-scroll on mobile.
- Tabs built from `[{ id: "all", label: "All" }, ...availableCats.map(c => ({ id: c.id, label: c.label }))]`.
- `value` = `activeCat`; `onChange` = `setActiveCat` (reuses existing filter state — no new state, no new query).
- Behavior:
  - `activeCat === "all"` → keep showing the existing mobile category tiles (screenshot 1 layout, with fix #1 applied).
  - `activeCat === <medium>` → hide the tiles and render the existing `WorkCard` list as a single-column vertical list on mobile (`grid-cols-1`), so tapping "Books" gives a column of just books. The desktop 3-col grid is preserved via `md:grid-cols-3`.
- Remove the now-redundant "← All categories" back button on mobile (chip row already exposes "All"); keep the desktop chip strip untouched.
- The sort dropdown continues to appear on mobile in its current row, just below the new chip scroller.

## Non-goals
- No schema/RLS/data-fetching changes, no new fields, no new routes.
- No desktop layout changes at `md+`.
- No changes to `LinkPills`, `CategoryScroller`, `WorkCard`, or Collab flow.

## Verification
- Playwright at 375×812 on a profile with covers across ≥2 mediums: tiles show white-on-dark label pills readable against both the bright plants cover and the dark drone cover; header block shows IG pill + bio under `@handle · Chicago`; tapping a chip in the swipeable row switches to a single-column list of that medium; tapping "All" returns to tiles.
- Desktop 1280×900 screenshot compared to current — pixel-identical.
- No horizontal overflow (`documentElement.scrollWidth <= innerWidth`).

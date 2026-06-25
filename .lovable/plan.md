## Goal
Tighten vertical rhythm on the group page by ~15% and make spacing around the news ticker feel intentional and equidistant. Visual-only edits.

## Current rhythm (measured)
- Hero title block → News ticker: **24px** (`mt-6` on ticker)
- News ticker → Tab bar: **8 + 32 = 40px** (`mb-2` on ticker + `mt-8` on sticky tab bar)
- Tab bar → Tab content: **32px** (`mt-8` on content)

## New rhythm (equidistant around the ticker, tighter overall)
- Hero → ticker: **16px**
- Ticker → tab bar: **16px**
- Tab bar → tab content: **20px**

Net savings ≈ 40px, ~17% tighter while making the ticker visibly symmetric within the header stack.

## Edits
- `src/components/group/group-news-ticker.tsx`: change wrapper `mt-6 mb-2` → `mt-4 mb-4`.
- `src/components/group/group-tab-bar.tsx`: change sticky container `mt-8` → `mt-0` (the ticker now owns the bottom gap).
- `src/routes/g.$slug.tsx`:
  - Remove the blank line inside `<div className="px-4 md:px-6">` (cosmetic).
  - Change tab content wrapper `mt-8` → `mt-5` (20px).
  - When the ticker is absent (no feed), preserve breathing room by giving the tab bar `mt-4` via a sibling-aware wrapper: simplest implementation — always render a single header stack `<div className="space-y-4">` containing `GroupHero`, `GroupNewsTicker`, `GroupTabBar`. Since `GroupNewsTicker` returns `null` when empty, `space-y-4` collapses to a single 16px gap between hero and tabs in the no-feed case (still tighter than today's 40px).

## Acceptance
- Gap above and below the ticker is visually identical (16px).
- Total header→content distance drops from ~96px to ~52px.
- When a group has no news feed, hero→tabs is 16px (no orphan whitespace).
- No changes to ticker styling, hero, or tab bar visuals — only spacing.

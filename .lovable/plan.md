# Fix Group title clipping in Browse-by-kind

**Problem (from screenshot, ~1280px Lovable workspace).** Each cluster card (Genres / Scenes / Micro / Cities) sits in a 2-col grid on `md+`, and inside each cluster the chip grid jumps to 2 columns at `sm:`. That leaves ~120–140px of text width per chip — so "SoundCloud", "Indie Filmmakers", "Hyperpop", "DIY Punk", "Vaporwave", "Cottagecore", "Hackathon Crews", "NaNoWriMo", "New York", "Los Angeles", "Chicago" all truncate to `Soun…` / `Indie…` / `New …`. Many 13"–14" laptops live in this exact width band, so the issue is load-bearing.

## Changes (presentation only)

### 1. `src/components/groups-browse-by-kind.tsx` — chip grid breakpoints
- Inner chip grid currently: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-2`.
- New: `grid-cols-1 2xl:grid-cols-2`. Single-column chips at every width up to 2xl means each chip gets the full cluster-card width (~360–500px on common laptops) and names stop truncating. Only ultra-wide displays go back to 2-up.
- Show up to 5 samples instead of 6 to keep card height roughly equal once chips are full-width (one-line chips are shorter than the prior 3×2 grid).

### 2. `src/components/group-card-compact.tsx` — squeeze the chip layout
- Shrink the leading icon tile from `h-9 w-9` → `h-7 w-7` and inner icon `h-4 w-4` → `h-3.5 w-3.5`.
- Reduce padding `p-2 pr-3` → `p-1.5 pr-2.5` and gap `gap-2` → `gap-2`.
- Title: keep `truncate` but bump to `text-sm` since there's more room; allow it to consume all remaining width via the existing `min-w-0 flex-1` wrapper.
- "In" pill and member-count: keep `shrink-0`; member-count text drops the `Users` icon at `<sm` (icon-less variant) to reclaim ~14px on the tightest widths — actually simpler: keep the icon, just rely on the wider single-column layout.

### 3. Cluster card header — also clipping risk
- Header row uses `flex items-start justify-between gap-3` and the title `<h3>` has no `truncate`. Wrap the title block in `min-w-0` and add `truncate` on `<h3>`; add `shrink-0` to the "See all N →" button (already present). Prevents future clipping if labels grow.

## Out of scope
- No copy changes, no data changes, no responsive break for the outer 2-col cluster grid (that layout is fine; the fix is inside each cluster).
- No changes to `GroupCard` (the full-size card used elsewhere) — only the compact chip.

## Verification
- View `/workshop/groups` at 1280×800 (the screenshot width): every chip name in Genres, Scenes, Micro, Cities is fully legible — no `…` on "SoundCloud Rappers", "Indie Filmmakers", "Hackathon Crews", "Vaporwave", "Cottagecore", "New York", "Los Angeles", "Chicago".
- At 1024px: same — single column, full names.
- At ≥1536px (2xl): chips reflow to 2 columns; long names may truncate again, which is acceptable at that width because the cluster card is much wider and there's still ~180px+ per chip.
- Mobile (<640px) unchanged in behavior, slightly tighter chip padding.

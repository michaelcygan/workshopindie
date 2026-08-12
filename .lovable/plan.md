# Collab Board pass — list-first, explained, clean toolbar

## Goal

Make the signed-in Collab Board read as a simple, scannable **list** with a clear explanation of what Collabs are, one tidy filter bar, and no overflowing category rail. Same treatment on desktop and mobile.

## 1. Header that explains Collabs

- Keep "Collab Board" as the H1, add a one-line definition beneath it: what a Collab is (an open call to make something together — post a brief, list roles, people join).
- Move the primary actions (Post Collab, My Collabs) into the header row; keep the live/open counts as small inline signals instead of a separate kicker row.
- Collapse the current three stacked rows (kicker chip + description + "3 open" pill) into one compact masthead band.

## 2. Fix and simplify the filter bar

The circled break is the category rail spilling past the toolbar (already fixed in the route, not yet on the live site — it ships on the next publish). This pass goes further:

- One filter row: **field dropdown** (single "All fields" menu with all 13 fields — no long scrolling chip rail on desktop), **city**, **Online only** toggle, and a new **keyword search**.
- Keyword search filters the loaded results by title, summary, and role names — instant, no extra query.
- Active filters render as small removable chips under the bar with a "Clear all" when more than one is on.
- Mobile: search full-width on its own line, then field / city / online as a single wrapping row of pills.

## 3. List-based results (replaces the 3-up card grid)

- Results become a single-column list of compact rows, full width, max ~1000px:
  - Line 1: title + status/openness signal (Accepting collaborators, live audio dot).
  - Line 2: one-line summary, clamped.
  - Line 3: field + city/online + roles wanted + posted-time + author, as small muted meta.
- Live Collabs are no longer a separate horizontal rail; they sort to the top of the list with a live marker (keeps one place to look while volume is low).
- Rows are full-width links with hover lift; mobile rows stack meta onto two lines.
- Empty state and loading skeletons updated to the list shape.

## 4. Result count and ordering

- Show "N open collabs" above the list, reflecting active filters.
- Keep existing ordering (live first, then newest with the openness lift, then group rerank).

## Technical notes

- All changes in `src/routes/collab.index.tsx` plus a new `src/components/collab/collab-row.tsx` for the list row; `src/components/collab-card.tsx` stays for other surfaces (profile, group pages).
- Category filtering keeps the existing `?cat=` search param and `normalizeCategory` handling, so existing links keep working. Keyword search is client-side only (no new param) to avoid query churn.
- No database, RLS, or query-shape changes.

## Verification

- Desktop 1024–1440px and mobile 390px: toolbar stays on one row (mobile two), nothing overflows.
- Filtering by field, city, online, and keyword each narrow the list correctly; clearing restores.
- Live collab appears at top with its marker.

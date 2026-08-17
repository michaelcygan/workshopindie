# Collabs sticky filter bar — Workshop standard

Bring `/collab` up to the same standard as Blog and Groups: one compact sticky row, taxonomy-first filters (Medium, Topic), city, format, and a "More filters" button for everything that doesn't fit.

## The bar (one line on desktop)

Left: **Search** — live, debounced, filters loaded Collabs by title, summary, and role names (client-side, no new query).

Right controls, in order:

- **Medium** — dropdown replacing the current horizontal field rail that overflows the bar (visible in the screenshot). Same width/height as the Groups and Blog selects, ordered by count.
- **City** — the shared `FilterCityPicker` (type-to-filter + A–Z quick skip) now used on Groups, replacing the current `CityCombobox` here so the pill matches. Disabled while Online only is on.
- **Format** — segmented pill: Any / In person / Online. Replaces the standalone "Online only" toggle and adds the in-person filter.
- **More filters** — icon button that opens a popover with the overflow set: **Topic**, **Live audio only**, **Paid / unpaid**, **Open to suggestions**. Shows a small count badge when any are active.
- **Clear** — round X, appears only when something is active.

Mobile: search on its own line, the rest as one wrapping/scrolling pill row; Medium, City and Format stay in the bar, everything else lives behind More filters.

## Masthead cleanup

Collapse the three stacked rows (title, kicker chip + description, "3 open" pill) into one compact band: H1 + one-line description on the left, My Collabs / Post Collab on the right, live and open counts as small inline signals. Result count ("N open collabs") moves to a `FilterMeta` line under the sticky bar.

## Topic filter behavior

`collab_post_topics` exists but currently holds no rows, so the Topic control renders only when the loaded Collabs actually carry topics — no empty dropdown. It lives in More filters until Collabs commonly have topics, then it can be promoted into the main row.

## Technical notes

- Changes in `src/routes/collab.index.tsx` plus a new `src/components/filter-header/filter-more.tsx` (the popover shell) reused later by other pages.
- URL params: keep `cat`, `city`, `cityName`, `online`; add `format` (replacing bare `online` semantics while keeping `online=true` working for existing links), `topic`, and optional flags for the overflow filters. Search stays client-side, no param.
- Medium options derive from `FIELD_FILTER_OPTIONS` with counts from loaded rows; city options come from the cities already referenced by Collabs plus the shared city list.
- No database, RLS, or query-shape changes; in-person filtering uses the existing `location_mode` column.

## Verification

Desktop 1024–1440px: bar stays on one line, nothing overflows past the toolbar. Mobile 390px: two lines, no clipping. Each filter narrows results and clears correctly; logged-out and signed-in render identically.

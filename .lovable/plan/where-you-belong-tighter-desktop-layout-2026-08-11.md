# "Where you belong" — tighter desktop layout

Today the joined-groups section on the signed-in Groups page renders three huge featured cards per row (large 16:10 covers), so six joined groups eat two full screens of space before anything else. Rebuild it as a compact one-row rail plus a complete list.

## New layout (desktop)

```text
Where you belong                                 8 groups joined
+------------------------------------------------------------+-------------+
| [thumb][thumb][thumb][thumb][thumb]  →  (horizontal scroll) | All groups  |
|  Chicago   Music   Visual Art  Film  Writing                | Chicago   3 |
+------------------------------------------------------------+ Music     3 |
                                                              | Visual Art 4|
                                                              | ... scroll  |
                                                              +-------------+
```

- Left: one horizontally scrollable row of small group tiles (~200px wide, 16:10 cover, name + member count beneath). Sorted by most recently updated/active first. Edge fade + subtle arrow affordances on hover; no vertical wrapping.
- Right: a compact sidebar list of **all** joined groups — avatar/cover chip, name, type (City/Field), member count — with its own scroll area capped to the rail height. Clicking a row navigates to the group.
- Below ~1024px: sidebar collapses; the rail stays a swipeable row (current mobile behavior preserved, just with the smaller tiles).

## Details

- Section height target: roughly one third of the current footprint.
- "Most recently updated" ordering uses the existing activity score plus latest activity timestamp available on the group card data; falls back to the current score sort if no timestamp exists.
- The larger `GroupFeaturedCard` stays in use for "Worth joining" — only the joined section changes.
- Keep full-card clickability and focus-visible styling already added to group cards.

## Technical

- Edit `src/components/groups/member-groups-home.tsx`: replace the joined-groups grid with a two-column `lg:grid-cols-[minmax(0,1fr)_280px]` block.
- New component `src/components/groups/joined-groups-rail.tsx` — small tile (reuses cover/placeholder logic from `group-featured-card.tsx`, extracted or duplicated minimally) plus the sidebar list.
- Show all joined groups (drop the current `.slice(0, 6)`); rail shows up to ~12, sidebar shows every one.

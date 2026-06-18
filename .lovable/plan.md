## Lock the left column: cap Featured events, redesign Trending now

Two coordinated fixes so the left column has a stable rhythm and nothing gets clipped.

### 1. `src/components/featured-events-compact.tsx` — cap height to empty-state size

The empty-state card is the visual baseline (~3 text rows tall). When events populate, the list currently grows to 6 items, blowing past that and pushing Trending down.

- Reduce `upcoming` from `slice(0, 6)` to `slice(0, 3)` — three event rows roughly equals the empty-state card height.
- Keep the list as-is below that; no scroll affordance needed at 3 rows.
- Empty state stays unchanged.

That gives Featured events a near-constant height across empty/populated, and the "extra" vertical space lives in Trending and the Join feed below — which is where you want depth.

### 2. `src/components/groups-trending-list.tsx` — single-column rows, no clipping

At the current left-column width (`lg:col-span-4` ≈ 280–340px), the 2-column grid (`sm:grid-cols-2`) crushes each pill to ~110px, so names truncate to "H…", "N…", "S…" — unusable as a chart.

- Drop the 2-column variant: keep a single column at every breakpoint (`grid-cols-1`, no `sm:grid-cols-2`).
- Tighten row vertical padding (`py-2`) to keep all 8 rows compact.
- Increase the name column's share: drop the per-row kind icon (`KIcon`) — the accent stripe + numeric rank already carry visual rhythm, the icon is what's stealing width. Keep the rank, accent stripe, name (truncates only when truly long), member count, and "In" chip.
- Tighten gaps: `gap-2.5` instead of `gap-3` so the name has more room.

Result: every group name reads in full at this width, 8 rows fit comfortably, and the column matches the right-side `Browse by kind` grid height without empty space.

### Out of scope

- No changes to `GroupsJoinFeedCard`, `GroupsBrowseByKind`, the route layout, the All-groups grid, or the SceneTicker.
- No schema or server-fn changes — display-only.

### Technical notes

- The route already uses `items-stretch` on the 12-col grid and `flex-1` on the Join feed card, so once Featured events stops growing, the Join feed naturally absorbs the freed space and the column bottom stays aligned with the right grid.
- The icon removal in Trending also removes the `KIND_ICON`/`KIcon` references; clean up the unused `MapPin, Sparkles, Zap, Flame` imports in the same edit.

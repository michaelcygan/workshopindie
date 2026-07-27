
# Groups page — showcase polish pass

Make `/groups` feel like a live showcase of what's happening across Groups, then land the full directory ("All") at the bottom. Same editorial system already in place — no new visual language, just more modules that surface real activity.

## New page order

```text
1. Editorial header + sticky search / kind switcher   (existing, unchanged)
2. Featured rail                                       (existing, unchanged)
3. Live activity ticker                                (new)
4. New members this week                               (new)
5. People to follow from your groups                   (new, signed-in only)
6. Adjacent scenes for you                             (new, signed-in only)
7. All groups — sortable/filterable directory          (existing, moved to bottom)
8. Suggest a group footer                              (existing, unchanged)
```

Anonymous visitors see 1, 2, 3, 4, 7, 8. Signed-in members also get 5 and 6.

## New modules

### Live activity ticker
Horizontal marquee-style rail (same visual family as the homepage news ticker) showing the last ~20 events across public groups: new group created, new event posted, new Today post, new Work shared to a group. Each chip links to the group. Auto-refreshes every 60s. Source: union of recent rows from `groups`, `group_events`, `group_today_posts`, `group_works` filtered to `visibility = 'public'` groups. Server function returns a normalized `{ kind, groupSlug, groupName, actor, title, at }[]`.

### New members this week
Compact horizontal rail of `{ group, joiner avatar stack (up to 5), count }` for the top ~8 public groups by new-member count in the last 7 days. Encourages "join where momentum is." Source: `group_members` joined `groups` with `created_at >= now() - 7d`, grouped by `group_id`.

### People to follow from your groups
Only if the viewer belongs to any group. Shows up to 8 profile cards of active members from the viewer's groups whom they don't already follow, ranked by recent activity (Today posts, works, event RSVPs in that group). Reuses `ProfilePeek` on hover and the existing follow button. Source: server fn that joins `group_members` (viewer's groups) → other members → excludes existing `follows`.

### Adjacent scenes for you
Only if signed-in. Up to 6 group cards the viewer isn't in yet, ranked by overlap: shared categories, shared city, and shared members with their current groups. Reuses `GroupCard` (compact variant already in place). Falls back to "Popular right now" when overlap is thin.

## Directory move

Cut the "All groups" section (kind switcher tabs + sort/filter + progressive list) out of its current mid-page position and re-mount it below the new modules under an `<h2>All groups</h2>` anchor. The sticky search bar at the top still deep-links into it (scrolls / filters). URL search params (`t`, `q`, `c`, `s`) keep working unchanged.

## Technical notes

- New server functions live in `src/lib/groups-showcase.functions.ts`:
  - `getGroupsActivityFeed()` — public, 60s stale
  - `getGroupsNewMembers()` — public, 5min stale
  - `getSuggestedGroupPeople()` — `requireSupabaseAuth`, 5min stale
  - `getAdjacentScenes()` — `requireSupabaseAuth`, 5min stale
- All four use `queryOptions` + `ensureQueryData` in the route loader, with `useSuspenseQuery` in the component. Auth-gated ones only mount their `<Suspense>` block when `viewerId` is present, so anonymous SSR never hits them.
- New components under `src/components/`:
  - `groups-activity-ticker.tsx`
  - `groups-new-members-rail.tsx`
  - `groups-people-rail.tsx`
  - `groups-adjacent-rail.tsx`
- No schema changes. No new tables. Reuses existing RLS-safe reads on public groups; suggestions filter through the viewer's own memberships server-side.
- Design tokens only — no hardcoded colors. Reuses `KickerChip`, `EditorialCard`, `GroupCard`, `ProfilePeek` for consistency with the rest of the refresh.

## Out of scope

Group detail page (`/g/$slug`) refresh, admin "feature a group" UI, and personalized ranking beyond the simple heuristics above — those stay open for a future pass.

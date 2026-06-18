## Problem

In the discovery band, the left column (Events + Trending 1–8) now ends well above the right column (Browse by kind, 4 clusters). On a 1024–1280px viewport that leaves a tall blank rectangle between the trending list and "All groups".

## Fix — add a "Spark" card under Trending

A single component, `GroupsSparkCard`, slotted into the left column right after `GroupsTrendingList`. It does three jobs at once so the space earns its keep:

1. **Manifesto** — one short editorial line that tells people what Groups are for.
   > "Groups are the rooms your work belongs in. Scenes, cities, sprints — find the one that pulls you in."
2. **Stat strip** — three tiny numbers pulled from data already loaded on the page:
   - `{allGroups.length}` rooms open
   - `{cityCount}` cities
   - `{microCount}` micro-sprints
3. **CTAs** — three buttons stacked, each with a small icon + label + sub-label:
   - **Start a Group** → `/groups/new` (primary, dark fill)
   - **Suggest a Scene** → `mailto:` or `/feedback?topic=group` (outline)
   - **Browse all** → scrolls to the All-groups grid (ghost, with arrow)

Visual treatment matches the existing Trending card — `rounded-3xl border border-border bg-surface shadow-soft`, accent dot, same heading scale — so it reads as a sibling, not a new section.

## Files

- **New** `src/components/groups-spark-card.tsx` — the component above. Takes `{ totalGroups, cityCount, microCount, onBrowseAll }` so it stays presentational.
- **Edit** `src/routes/groups.index.tsx` — render `<GroupsSparkCard>` inside the `lg:col-span-4` stack, after `GroupsTrendingList`. Pass derived counts from `allGroups`. Wire `onBrowseAll` to scroll the `<section>` that holds the All-groups grid into view (add a ref).

## Out of scope

- No new routes, no schema changes.
- "Start a Group" links to existing `/groups/new` if present; if not, falls back to opening the existing Create flow.
- No changes to the right column or to the All-groups grid below.

## Why this and not more clusters / a marquee

We already tried a vertical marquee (felt unconsidered) and stacking more clusters (made the right side feel orphaned). A Spark card is finite-height by design — it sizes to its content, balances the column visually, and converts dead space into an explicit invitation to act (start, suggest, browse) plus the only place on the page that says *what Groups are*.

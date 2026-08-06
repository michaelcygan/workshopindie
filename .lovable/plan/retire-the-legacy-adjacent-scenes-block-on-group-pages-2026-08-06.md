# Retire the legacy "Adjacent scenes" block on Group pages

Yes — the Group page renders "Adjacent scenes" twice.

1. **New (keep):** the compact module card in the Today module rail, sitting next to Recent Collabs / Recent Works.
2. **Legacy (retire):** a full-width "Adjacent scenes / 7 related / Members of this group also joined" section rendered below all tab content, on every tab.

## What changes

- Remove the legacy full-width section from the bottom of the Group page shell, along with its import and the now-empty spacing wrapper.
- Delete the legacy rail component, since the Group page is its only consumer.
- Leave the Groups index page untouched — it uses a different "Adjacent scenes for you" rail that stays as-is.
- No change to the module-rail card, tab navigation, spacing of remaining sections, or any other Group functionality.

## Technical detail

- `src/routes/g.$slug.index.tsx`: drop the `AdjacentGroupsRail` import and the `<div className="mt-16">…</div>` block that wraps it.
- `src/components/adjacent-groups-rail.tsx`: delete (no other references).
- `src/components/groups-adjacent-scenes-rail.tsx` (used by `src/routes/groups.index.tsx`) and the rail card inside `src/components/group/group-today-tab.tsx` are unaffected.

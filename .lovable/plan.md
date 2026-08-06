# Audit: legacy "Adjacent scenes" removal

## What is done
- The full-width "Adjacent scenes" section is gone from the Group page shell (`src/routes/g.$slug.index.tsx`) — no references remain.
- The old component file `src/components/adjacent-groups-rail.tsx` was deleted.
- The compact "Adjacent scenes" card next to Recent Works still exists in the Today module rail.

## What is broken
The deletion removed a hook that was still in use. `src/components/group/group-today-tab.tsx` line 24 imports `useAdjacentGroups` from the deleted file, which:
- fails the build (`Could not load .../adjacent-groups-rail`), and
- fails typecheck (TS2307, plus a resulting implicit `any` on line 786).

So the change is functionally complete but not shippable as-is.

## Fix
1. Add `src/components/group/use-adjacent-groups.ts` containing a `useAdjacentGroups(groupId)` React Query hook that reproduces the deleted behavior: read this group's members, find the other public groups those members belong to, rank by overlap, and return the top few with `id, slug, name, avatar_url, member_count`.
2. Update the import in `group-today-tab.tsx` to point at the new hook and type the `.map((g) => ...)` callback with the hook's row type (clears TS7006).
3. Run typecheck and the dev build to confirm both errors are gone, then confirm the compact card still renders on a group page.

No visual or behavioral change intended — this only restores the data hook the surviving card depends on.

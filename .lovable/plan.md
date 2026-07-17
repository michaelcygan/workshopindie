
## Goal

Remove the "In Progress" tracker/board from v1 without breaking any surface. The underlying `workshop_tasks` table (per-workshop tasks) stays — only the cross-app aggregator, its page, badge, and pickup surfaces are cut.

## Scope (verified)

Feature-only files to delete:
- `src/routes/in-progress.tsx` — the `/in-progress` page (310 lines)
- `src/lib/in-progress.functions.ts` — the aggregator server fn (201 lines)
- `src/hooks/use-in-progress-badge.ts` — badge query hook (55 lines)
- `src/components/pickup-card.tsx` — signed-in homepage "resume" card (87 lines)

Surfaces to edit (remove imports + JSX only):
- `src/routes/index.tsx` — drop `PickupCard` import and its render at line 220.
- `src/components/mobile-nav.tsx` — drop `useInProgressBadge`; remove the count badge overlay on the "You" avatar.
- `src/components/top-nav.tsx` — drop `useInProgressBadge`, the `InProgressBadgeDot` component, the `InProgressCountPill` component, and the "In progress" dropdown menu item.
- `src/components/settings-menu-button.tsx` — drop `useInProgressBadge` and the "In progress" menu item + its count pill.

Route tree (`src/routeTree.gen.ts`) regenerates automatically once `in-progress.tsx` is gone — do not edit by hand.

## Not touched (intentionally)

- `workshop_tasks` table, its RLS, and any per-workshop task UI inside a Workshop stay as-is — v1 workshops still track their own tasks; only the cross-app tracker leaves.
- Copy strings that happen to say "in progress" (`me.collabs.tsx` "drafts in progress", `events.index.tsx` "work-in-progress nights") are unrelated and stay.
- No DB migration needed.

## Verification after edits

- `rg "in-progress|InProgress|useInProgressBadge|PickupCard"` under `src/` (excluding `routeTree.gen.ts`) returns no hits.
- Build passes; `/in-progress` 404s (expected); homepage, top nav, mobile nav, and settings menu render without the removed items.

Two fixes in `src/routes/u.$username.tsx`.

## 1. React error #310 — hook count changes between renders

**Root cause (confirmed by reading the file):** the `useMemo` at line 497 and the two `useEffect`s at lines 502 and 511 (plus `useState(seenCollabKey)` at 312 — that one is already above the returns, fine) are declared AFTER two early returns:

- `if (isLoading) return …` at line 420
- `if (!profile) return …` at line 428

On the first render (loading) only the hooks above line 420 run. On the next render (profile loaded) three more hooks run — React aborts with "Rendered more hooks than during the previous render" (minified #310). This is why the profile crashes in the IG in-app browser, where the render sequence is more likely to hit the loading path first.

**Fix:** move the collab-alert hook block (the `latestCollabKey` `useMemo`, both `useEffect`s, and the `dismissKey` / `hasUnseenCollab` derivations) to sit ABOVE the two early returns, alongside the other `useQuery`s and the existing `useState(seenCollabKey)`. Guard them against `profile` being `null`:

- `dismissKey = profile ? \`profile-collab-seen:${profile.id}\` : null` (already null-safe).
- `latestCollabKey` `useMemo` already handles empty `openCollabs`.
- Both `useEffect`s already early-return when `dismissKey` is null.

No other hooks live below the returns, so this single move restores a stable hook order across every render path. `markCollabsSeen` is a plain function (not a hook) and can stay where it is or move with the block — no ordering impact.

## 2. Mobile header — stop the Follow / Share / Report cluster from squishing the name

**Current layout (lines 599–610):** the identity block on mobile is a two-column grid `grid-cols-[minmax(0,1fr)_auto]` where the right column stacks Follow on top, then a Share + Report + Block row underneath. At IG's ~390 px the right column is wide enough to force the name column narrow AND still leaves the ugly dead band under the name that the screenshot circles.

**Fix — stop competing for the same row on mobile.** Restructure the mobile identity block so:

- The name row is full-width: just `<h1>` + `CreatorBadge`, no action column beside it. Drop the grid on mobile; keep the current desktop layout untouched (`md:` and up already renders actions in the avatar row via the block at line 593).
- Directly under the name row (still inside the identity block, still `md:hidden`), render a single full-width action row: `flex items-center gap-2` with `<FollowButton>` taking `flex-1` (or `w-full` inside a `flex-1` wrapper) so it grows to fill available space, followed by icon-only `MessageButton`, `ShareSheet`, `ReportDialog`, `BlockButton` at `shrink-0`. Owner view collapses to `<Edit profile>` full-width + `ShareSheet` icon.
- To keep visitor/owner branches tidy, split `renderProfileActions` into `renderMobileActions()` (full-width row, icon-only secondaries) and keep the existing `renderProfileActions()` for the desktop avatar row unchanged.

This makes the header dynamic across 320 / 360 / 375 / 390 / 430:
- Name always gets the full row width — no squish, no wrap into the buttons, no dead space under the name.
- The action row below is one line at every width because the secondary buttons are icon-only on mobile (each already exposes an `aria-label`). Follow stays the visually dominant primary action.
- Desktop (`md:` and up) is byte-for-byte unchanged.

## Verification

- Load `/u/michaelcygan` in the preview at mobile widths (375, 390, 430) — name is full-width, action row is one line below, no clipping.
- Reload the profile URL in the IG in-app browser on iPhone — no "Couldn't load this profile" #310 crash; profile renders through the loading → loaded transition.
- Desktop `md:` layout visually identical to today.

## Files touched

- `src/routes/u.$username.tsx` only. No schema, routing, or business-logic changes.

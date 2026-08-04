# Make the mobile "Now" section live like desktop

## What's happening

On mobile, the Now section renders a different, static component than desktop. It shows exactly three hardcoded rows (Today board, audio, next event) with no rotation and no suggestion engine — so when there's no activity, you see the same three empty-state lines forever. Desktop uses the departures-board component, which pulls from the same suggestion pool and rotates.

## The change

Replace the static mobile module with a mobile version of the Now board that shares the desktop logic:

- Build the same three lanes (LIVE / MAKE / EXPLORE) from the shared board builder, so mobile draws on real activity, your continue-actions, and the curated prompt pool.
- Show one row per lane, stacked, matching the current mobile row styling (icon circle, title, detail, chevron) so nothing about the look changes.
- Auto-rotate each lane on the same staggered cadence as desktop, pausing when the tab is hidden or the user prefers reduced motion, and pausing briefly while a row is being touched so a tap never lands on a row that just swapped.
- Support prompted actions (start a blog draft, start a Collab) the same way desktop does, including the "Opened your current draft" toast and navigation.
- Keep the header lightweight on mobile: no prev/next arrows; just the section title. Rotation handles variety.

## Technical notes

- New component `src/components/home/now-board-mobile.tsx` reusing `buildNowBoard`, `sessionSeed`, `markShown` from `src/lib/home-now-select.ts` and the action handling pattern from `now-board-desktop.tsx` (`createMyBlogDraft`, `isBlogSeedPromptId`).
- Extract the shared rotation/action logic from `now-board-desktop.tsx` into a hook (`useNowBoardRotation`) so desktop and mobile stay in sync rather than duplicating timers.
- `src/components/home/member-home.tsx` swaps `NowModule` for the new mobile board inside the existing `HomeSection`; `now-module.tsx` is removed once unreferenced.
- Icons per lane preserved: message square (live/today), radio (audio), calendar (events), with sensible defaults for prompt rows.
- Purely presentational — no data-contract, server-function, or database changes.

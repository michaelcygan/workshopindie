# Fix the empty composer notch on mobile

## Problem

On create/edit flows (`/works/new`, `/collab/new`, `/works/:slug/edit`, `/collab/:slug/edit`, blog editor), the mobile action island hides the center "+" button and renders an empty muted circle in its place. The bar looks broken.

## Change

1. **Always show the "+" composer button.** Remove the composer-hiding path logic in `src/components/mobile-island/use-mobile-island-visibility.ts` (`pathHidesComposer` and the `composerVisible` distinction). The island either shows fully or is hidden entirely — never with a hole. The placeholder circle branch in `mobile-action-island.tsx` gets deleted along with it.

2. **Don't lose in-progress work.** Because the composer can now navigate away mid-form, add a small `use-form-draft-stash` hook that mirrors form state into `sessionStorage` (keyed by route) and restores it when the user comes back. Wire it into `/works/new` and `/collab/new`. The blog editor already persists drafts server-side, so it needs no change.

3. Routes that hide the whole island (login, onboarding, lounge rooms, blog editor) keep that behavior unchanged.

## Technical notes

- `useMobileIslandVisibility` returns only `islandVisible`; call sites that read `composerVisible` (`mobile-action-island.tsx`) are updated accordingly.
- Stash hook: `sessionStorage` key `workshop:draft:<pathname>`, JSON-serialized, cleared on successful submit and on explicit cancel.
- No backend or schema changes.

# Mobile bottom bar: always keep the compose button

## The problem

On create/edit screens the center slot of the mobile bar renders an empty grey circle instead of the + button. It reads as a broken hole in the bar. Screens affected today:

- Post a Work (`/works/new`) and Edit Work
- Post a Collab (`/collab/new`) and Edit Collab
- Any route ending in `/edit`
- Blog editor (`/me/blog/:id`) — here the whole bar is hidden, not just the composer

## What changes

1. **The + button is always there.** Remove the "hide the composer" rule entirely; delete the empty-circle placeholder. The bar keeps one shape on every screen.
2. **Blog editor keeps its distraction-free mode** but no longer produces a half-bar: the bar stays fully hidden there (bar hidden = fine; bar with a hole = not fine). Same for the auth screens, lounge rooms, and group pages that already hide the whole bar.
3. **Leaving a create flow via + doesn't lose work.**
   - Blog editor: the existing draft save runs before navigating away.
   - Post a Work / Post a Collab: the in-progress form is stashed in session storage and restored when the user returns to that screen, with a small "Restored your draft" note and a way to discard it.
   - Edit screens: unsaved-changes confirm before navigating away (no silent discard of a live published item).
4. The bar still hides while the keyboard is open, so the + never covers an active input.

## Audit result (for reference)

| Screen | Today | After |
| --- | --- | --- |
| Post a Work / Edit Work | empty circle | + button, form auto-stashed |
| Post a Collab / Edit Collab | empty circle | + button, form auto-stashed |
| Other `*/edit` routes | empty circle | + button, confirm on leave |
| Blog editor | whole bar hidden | unchanged (draft saved on any exit) |
| Login/signup/onboarding, lounge room, group page | whole bar hidden | unchanged |

## Technical notes

- `src/components/mobile-island/use-mobile-island-visibility.ts`: drop `pathHidesComposer` and always return `composerVisible = islandVisible`.
- `src/components/mobile-island/mobile-action-island.tsx`: remove the `aria-hidden` placeholder branch and the conditional grid/flex switch — always the 3-column grid.
- New small hook `src/hooks/use-form-draft-stash.ts` (sessionStorage, keyed by route) used by `works.new.tsx` and `collab.new.tsx`.
- Blog editor: call the existing save mutation from a `beforeunload`/unmount path in `me.blog.$id.tsx`.
- Frontend only; no schema or server-function changes.

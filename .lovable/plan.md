# First-run walkthrough for the Create Work flow

Mirror the Collab composer walkthrough: a dismissible 4-step intro that appears the first time a signed-in member opens `/works/new`, and never returns once skipped or completed.

## Steps shown

1. **Paste a link, or start blank** — Work accepts a link from YouTube, SoundCloud, Vimeo, Bandcamp and more; Workshop pulls in title, cover and embed automatically. Manual entry is always available.
2. **Name it and pick a Field** — Title plus one Field (Music, Film & Video, Writing, etc.) is all that's required; add a Format for extra specificity.
3. **Add cover, credits and assets** — Frame the cover, credit collaborators, and attach extra media so the Work presents well everywhere it appears.
4. **Publish and connect it** — Publishing gives a shareable page, auto-connects the Work to its Field group, and everything stays editable afterwards.

## Behavior

- Opens automatically on first visit for a signed-in user.
- Progress dots, Back / Next, and a Skip link; final button reads "Start a Work".
- Dismissal (skip, finish, or closing the dialog) persists forever in local storage per user.
- Logged-out visitors never see it.

## Technical notes

- New component `src/components/nudges/work-composer-walkthrough.tsx`, modeled on `collab-composer-walkthrough.tsx` (same Dialog primitive, step state, dot indicator).
- Storage key follows the existing `nudge:` convention: `nudge:work-composer-intro:<user-id>`, wrapped in try/catch for disabled storage.
- Rendered once inside `NewWork` in `src/routes/works.new.tsx`, alongside the existing page content — no changes to form logic, validation, or submission.
- Optional small refactor: the two walkthroughs are near-identical, so the step-dialog shell can be extracted into a shared `NudgeWalkthrough` component that both files feed a `steps` array and storage key into. Keeps behavior identical.

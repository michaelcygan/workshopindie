# First-run walkthrough for the blog post composer

Mirror the Collab and Work composer walkthroughs: a dismissible 4-step intro that appears the first time a signed-in member opens the blog editor, and never returns once skipped or completed.

## Steps shown

1. **Write it like a draft** — Everything starts private. Nothing is visible until you publish, and saves happen on demand.
2. **Paste links to embed them** — Dropping a URL on its own line turns into a visual embed (video, audio, link card) right in the editor. Markdown works for the rest.
3. **Set the details** — Cover image, Field, category and excerpt live in the Details tab; they shape how the post looks on the Blog page and when shared.
4. **Publish and connect it** — Publishing gives a shareable page, and "About this post" lets you link the Works, Collabs or Events behind it. Everything stays editable.

## Behavior

- Opens automatically on first visit to the editor for a signed-in user.
- Progress dots, Back / Next, and a Skip link; final button reads "Start writing".
- Dismissal (skip, finish, or closing the dialog) persists forever in local storage per user.
- Shows once total, not once per post.

## Technical notes

- New component `src/components/nudges/blog-composer-walkthrough.tsx`, modeled on `work-composer-walkthrough.tsx` (same Dialog primitive, step state, dot indicator).
- Storage key follows the existing `nudge:` convention: `nudge:blog-composer-intro:<user-id>`, wrapped in try/catch for disabled storage.
- Rendered once inside the editor component in `src/routes/me.blog.$id.tsx` — no changes to editor state, saving, or publishing logic.

# Add the blog compose action buttons at the bottom of the page

## What to do

Add the same three action buttons that currently live at the top of the member blog compose page (Save, Publish / Unpublish, and the overflow More actions) to the bottom of the page, so users can save or publish without scrolling back to the top after a long post.

## Where the change lives

- `src/routes/me.blog.$id.tsx` — the member blog editor route.

## How it will be done

1. Extract the existing top-right action button row (Save, Publish / Unpublish, and the three-dot overflow menu) into a small local helper component, `PostActions`, inside the route.
2. Render `PostActions` in its existing top location and again at the bottom of the Edit tab content, below the `BlogBodyEditor`. Also render it on the Details tab and any other relevant tab where it makes sense to keep the action bar visible.
3. Ensure the helper receives the same mutation handlers, dirty state, and access checks so both locations behave identically (no duplicated state).

## What will stay the same

- No visual or behavior change to the top buttons.
- No new server functions or database changes.
- The same gating logic: Publish only when not published; Unpublish when published; Delete draft only inside the overflow menu when applicable; Save disabled when clean or read-only.

## Verification

- Open a blog draft in the editor, scroll to the bottom of the page, and confirm Save and Publish appear below the body editor.
- Make a change, click the bottom Save button, and confirm the draft saves.
- Confirm the top buttons continue to work unchanged.
- Open a published post and confirm the bottom bar shows Save and Unpublish/View live as appropriate.

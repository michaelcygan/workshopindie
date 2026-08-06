# Fix the "Couldn't load this profile" crash on profile links

## What's actually wrong

The profile page is not failing to load data — it crashes while rendering, and the crash is caught by the page's own error screen, which then shows the React error text ("Minified React error #310").

Confirmed cause: in `src/routes/u.$username.tsx`, the Influences data hook (`useInfluences`) is called near the bottom of the component, *after* three early exits (loading state, error state, profile-not-found state). React requires every hook to run in the same order on every render. On the first render the component exits early at the loading state and that hook never runs; once data arrives, the hook suddenly appears — React throws #310 and the page collapses into the error screen.

This is the only hook placed after the early returns in that component (verified by scanning the rest of the render body), so it is a single, contained bug.

## The fix

In `src/routes/u.$username.tsx`:

1. Move the `useInfluences` call up with the other data hooks at the top of the component, before any `return`. Keep passing the profile id, which is simply undefined until the profile loads (the hook already tolerates that).
2. Leave the derived `counts.influences` usage where it is — it reads the same value.

No changes to data, permissions, layout, or copy.

## Verification

Load a profile URL both signed out and signed in and confirm the page renders normally instead of the "Couldn't load this profile" screen, with no React error in the console.

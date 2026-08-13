# Swap Groups and Collabs mobile bottom-nav icons

The mobile action island uses a single icon config file. We will exchange only the two icons the user called out, leaving Gallery, Events, Blog, and the composer untouched.

## What changes

- In `src/components/mobile-island/mobile-tabs-config.ts`:
  - **Groups** → uses the `Users` icon (currently assigned to Collabs).
  - **Collabs** → uses the `Sparkles` icon (currently assigned to Groups).
- Import order can be cleaned up so `Users` is no longer misleadingly grouped before `Sparkles`.

## What does not change

- No labels, routes, active states, or layout change.
- No desktop or logged-out navigation changes.
- The composer icon, Gallery, Events, and Blog stay as they are.

## Verification

- Run the project's typecheck/build command to confirm the icon swap compiles cleanly.
- Check the mobile preview at a narrow viewport to see the new icon pairing in the bottom bar.

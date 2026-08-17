Hide the mobile bottom island for logged-out blog viewers

## Goal
Mirror the existing logged-out profile behavior for blog surfaces: remove the mobile action island from the bottom of the page so anonymous visitors see the blog content without member-navigation chrome.

## What will change
- Update `src/components/mobile-island/use-mobile-island-visibility.ts` so that when no user is authenticated, the island is hidden on any route under `/blog`.

## Current behavior
- The same hook already suppresses the island for logged-out users on:
  - The homepage (`/`)
  - Profile routes (`isProfilePath`)
  - Work detail routes (`/works/...`)
- The `MobileActionIsland` component also manages the shared `--mobile-island-clearance` CSS variable, so the page bottom is automatically repadded when the island is hidden.

## Implementation
- In `useMobileIsland-visibility.ts`, after the existing `!user && (isProfilePath(...) || pathname.startsWith("/works/"))` branch, add a similar branch:

```text
if (!user && pathname.startsWith("/blog")) {
  return { islandVisible: false, composerVisible: false };
}
```

- This covers `/blog`, `/blog/:slug`, and `/blog/category/:category`.
- No other routes or components change.
- No backend / schema changes are needed.

## Verification
- Open a blog post (e.g. `/blog/:slug`) in the mobile preview while logged out.
- Confirm the bottom action island is not present.
- Confirm the page still shows the mobile brand header with "Sign in" / "Join" and the site footer.
- Confirm that logged-in users still see the bottom island on blog pages.

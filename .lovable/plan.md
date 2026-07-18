Extend the existing logged-out mobile nav hiding pattern from public profiles to public work pages so the Work page feels more standalone when shared to logged-out visitors (e.g., from Instagram in-app browser).

### Change
- In `src/components/mobile-nav.tsx`, add a path check so the bottom island is not rendered for logged-out users on `/works/*`.
- Update the inline comment to reflect that both public profile and public work pages are treated as standalone surfaces without the bottom nav.

### Scope
- Only mobile view (component already renders only below `md` breakpoint via `md:hidden`).
- Only logged-out users; logged-in users still see the island on Work pages.
- Does not add, remove, or change other bottom-nav behavior.

### Verification
- Preview the Work page in a mobile viewport while logged out and confirm the bottom island is gone and the page content remains fully scrollable to the bottom.
- Confirm logged-in mobile view still shows the island on Work pages.
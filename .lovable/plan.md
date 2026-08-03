## Plan: Verify signed-in Member Home at mobile widths

### Goal
Confirm the rebuilt authenticated Member Home renders cleanly at 375px and 390px without clipping, overflow, or rhythm issues, and that the new compact modules (featured Blog header, Now, Your Workshop, From the Blog) work on a real signed-in session.

### Steps
1. Restore the injected managed Supabase session in a fresh Playwright Chromium run and navigate to `http://localhost:8080/` (the authenticated root will render MemberHome).
2. Set viewport to 375×735 CSS px, wait for hydration, and capture a full-height screenshot of the first viewport and the area below the fold.
3. Set viewport to 390×735 CSS px and repeat the capture.
4. Inspect the screenshots for:
   - Featured Blog header height and cover placement (~180–210px)
   - Carousel dots / prev-next controls visible and not clipped
   - “Now” module fits roughly one card-height and actions are tappable
   - “Your Workshop” rail snap-cards visible and readable
   - “Keep going” row not overlapping content
   - “From the Blog” rail cards with covers/typographic fallbacks
   - No bottom mobile island covering the final rail or actions
   - No horizontal overflow or squashed text
5. If any regressions are found, patch the specific component and re-capture.
6. Report back with screenshots and a short findings list (or “all clear”).

### Out of scope
- No new features or layout redesigns.
- No changes to PublicHome or desktop layout unless a mobile regression overlaps.

### Verification
Playwright screenshots at 375px and 390px plus console log check for errors during hydration.
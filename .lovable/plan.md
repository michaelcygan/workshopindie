## Fix: Save bar hidden behind mobile bottom nav on /me/edit

**Problem**
The sticky save bar (`src/routes/me.edit.tsx` L559–576) is `fixed bottom-0 z-30`. The mobile island nav (`src/components/mobile-nav.tsx`) sits `fixed bottom-3 z-50 md:hidden` and floats over the save bar on mobile, so Save/Discard are unreachable.

**Change (one file: `src/routes/me.edit.tsx`)**
- Save bar wrapper: replace `bottom-0` with `bottom-20 md:bottom-0` so it clears the ~64px mobile island (island height + `bottom-3` gap) while staying flush on desktop.
- Add `mx-3 md:mx-0 rounded-2xl md:rounded-none border md:border-t md:border-x-0 shadow-lg md:shadow-none` so the lifted mobile bar reads as an intentional floating card matching the island, and stays a plain edge-to-edge bar on desktop.
- Bump the main container's mobile bottom padding from `pb-32` to `pb-40` so the last form section isn't obscured when the save bar is visible.

No changes to the mobile nav component, desktop layout, or any other route.

**Verification**
Mobile viewport on `/me/edit` with a dirty form: Save and Discard buttons are fully visible and tappable above the island; desktop unchanged.
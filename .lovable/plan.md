## Goal
Give logged-out mobile visitors access to the top-right menu so they can reach Blog, Gallery, and Events (which are currently hidden because `SettingsMenuButton` returns `null` when there is no user).

## Change
Edit `src/components/settings-menu-button.tsx`:

- Remove the `if (!user) return null` early return.
- When `user` is null, render the same trigger (settings/menu icon) but with a slimmed-down `DropdownMenuContent`:
  - "Explore" section: **Gallery**, **Events**, **Blog** (same icons as the signed-in menu).
  - Separator.
  - **Sign in** item → navigates to `/auth`.
- When `user` is present, keep the existing full menu unchanged.

No other files need to change — `MobileBrandHeader` already renders `SettingsMenuButton` unconditionally, so removing the null guard automatically surfaces the menu for logged-out mobile users. Desktop `top-nav` uses its own account dropdown and is unaffected.

## Technical notes
- Reuse existing `DropdownMenu`, `LayoutGrid`, `Calendar`, `BookOpen`, `SettingsIcon` imports.
- Trigger keeps `aria-label="Menu"` (updated from "Settings and account" when logged out) for accessibility.

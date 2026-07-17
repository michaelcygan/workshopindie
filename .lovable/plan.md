## Goal
Add a persistent Settings gear to the mobile header (next to DM + Notifications) and simplify the bottom nav's "You" tab so it navigates straight to the profile.

## Changes

### 1. `src/components/mobile-brand-header.tsx`
Add a new `SettingsMenuButton` to the right cluster so the header shows three circular icons: **Settings · DM · Bell**.

The gear opens a dropdown (same shape as today's avatar dropdown) containing:
- Your stuff: In Progress (with badge), My Collabs, Network, My RSVPs
- Explore: Gallery, Events
- Refer & Earn
- Settings
- Sign out

Also includes a top row linking to `/me` (avatar + display name + "View your profile") for parity with the current menu.

### 2. `src/components/settings-menu-button.tsx` (new)
Extract the dropdown currently living inside `MobileNav`. Trigger is a 9×9 circular icon button matching the DM/Bell styling (`ring-1 ring-border`, `hover:bg-muted`, `Settings` icon from lucide). Uses `useAuth`, `useInProgressBadge`, `supabase.auth.signOut`, `useNavigate`. Renders nothing when signed out.

### 3. `src/components/mobile-nav.tsx`
Replace the `DropdownMenu`-wrapped "You" button with a plain `<Link to="/me">` that shows the avatar + in-progress badge + "You" label, with active styling. Signed-out state (Sign in link) is unchanged. Remove now-unused imports (DropdownMenu*, supabase, useNavigate, most lucide icons — keep only what the remaining tabs use).

### 4. Desktop untouched
`MobileBrandHeader` is `md:hidden`, so the gear is mobile-only. Desktop header/nav keep their current avatar dropdown.

## Notes
- Badge on gear: if the in-progress count > 0, show the same small pill on the gear button so users don't lose the "something needs attention" cue that used to sit on the avatar.
- No routing changes, no backend changes.

## Files
- edit `src/components/mobile-brand-header.tsx`
- edit `src/components/mobile-nav.tsx`
- new  `src/components/settings-menu-button.tsx`
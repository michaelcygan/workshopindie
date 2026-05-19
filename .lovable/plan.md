## Desktop header (`src/components/top-nav.tsx`)
- Replace nav with 4 flat items: **Workshop** → `/instant`, **Collab** → `/collab`, **Gallery** → `/`, **Cities** → `/cities`.
- Remove "More" dropdown and the "Profile" link (profile stays in the right-side avatar dropdown).
- Right cluster unchanged: `Post a Collab`, `NotificationsBell`, avatar dropdown.
- Hide the entire `<header>` on mobile (`hidden md:block`).

## Mobile floating pill (`src/components/mobile-nav.tsx`, new)
- `fixed bottom-4 inset-x-4 z-50 md:hidden`, rounded-full pill, `bg-background/90 backdrop-blur-md`, border, soft shadow.
- 4 icon+label tabs: **Workshop** (Radio), **Collab** (Users), **Gallery** (LayoutGrid), **Cities** (MapPin), with active-route highlight via TanStack `Link activeProps`.
- **Center FAB**: raised circular primary button (Megaphone) sitting above the pill, links to `/collab/new`. Bar splits 2 tabs / FAB / 2 tabs.
- Right edge of pill: avatar (signed in) opens existing profile menu, or "Sign in" link (signed out). Unread notifications shown as a small dot on the avatar.

## Layout (`src/routes/__root.tsx`)
- Mount `<MobileNav />` alongside `<TopNav />`.
- Add `pb-28 md:pb-0` to the main content wrapper so the pill/FAB doesn't cover content.

## Files
- edit `src/components/top-nav.tsx`
- create `src/components/mobile-nav.tsx`
- edit `src/routes/__root.tsx`

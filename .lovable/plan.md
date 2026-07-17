## 1. Hide mobile bottom nav for logged-out profile viewers

In `src/routes/u.$username.tsx`, add a body class (e.g. `data-hide-mobile-nav`) or use a context flag when `!user`, and update `src/components/mobile-nav.tsx` to return `null` when on a `/u/$username` route AND the viewer is logged out.

Cleanest approach: in `mobile-nav.tsx`, read `useAuth()` and `useRouterState({ select: s => s.location.pathname })`. If `!user && pathname.startsWith("/u/")`, return `null`. This scopes the hide to logged-out profile views only — every other page (Home, Groups, etc.) keeps the island for logged-out users as it is today.

Result: an IG in-app browser visitor landing on a profile sees a clean portfolio-style page. The sticky "Workshop" header in `mobile-brand-header.tsx` remains the only way back into the app.

## 2. Redesign the mobile category pill

In `src/components/category-scroller.tsx`, update the mobile branch:

- Change wrapper from `inline-flex` to full-width `flex` so the trigger stretches to the row.
- Change the trigger `<button>` to `w-full justify-center` (currently `inline-flex items-center gap-1.5`) so the label is centered with the chevron sitting just to its right.
- Keep border, radius, background, and font size consistent with the medium chip row it sits next to — so it visually reads as a peer control, flush and aligned, not a small orphan.
- Widen the dropdown content (`w-56`) so the option list matches the wider trigger.

The desktop branch is unchanged.

## Files touched

- `src/components/mobile-nav.tsx` — conditional early return for logged-out `/u/*`.
- `src/components/category-scroller.tsx` — full-width centered mobile trigger.

No backend, no data, no other flows affected.

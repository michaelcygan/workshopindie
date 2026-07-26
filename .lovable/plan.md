## Goal
Replace Workshop's crowded 5-tab mobile bar with a balanced 4-tab **action island** — Lounge · Collabs · **+** · Groups · You — where inactive tabs are icon-only, the active tab expands into a tinted pill with an animated label, and a raised center Create button opens the same three composer actions as the desktop Create menu (Post to Gallery / Post a Collab / Write a blog post). Route-aware visibility, keyboard awareness, and safe-area handling are treated as first-class concerns. Extract reusable primitives instead of one monolithic file.

## Wave 1 — Structure & primitives (island + tabs, no composer yet)

New files under `src/components/mobile-island/`:

- `index.ts` — barrel re-export.
- `mobile-tabs-config.ts` — data-driven tab and create-action lists. Shape:
  ```ts
  export const mobileTabs = [
    { id: "lounge",  label: "Lounge",  to: "/lounge", icon: Radio,    side: "left" },
    { id: "collabs", label: "Collabs", to: "/collab", icon: Users,    side: "left" },
    { id: "groups",  label: "Groups",  to: "/groups", icon: Sparkles, side: "right" },
    { id: "you",     label: "You",     to: "/me",     icon: null,     side: "right" }, // renders avatar
  ] as const;

  export const mobileCreateActions = [
    { id: "work",   label: "Post to Gallery",   description: "Add a Work to your portfolio",     to: "/works/new", icon: Briefcase },
    { id: "collab", label: "Post a Collab",     description: "Find people to make something",    to: "/collab/new", icon: Megaphone },
    { id: "blog",   label: "Write a blog post", description: "Share process, notes, or essays",  to: "/me/blog",    icon: BookOpen },
  ] as const;
  ```
- `use-active-tab.ts` — maps `pathname` to a tab id using rules: `/lounge*` → lounge (but not `/lounge/:id` alone — that hides the whole island anyway), `/collab*` → collabs, `/groups*` or `/g/*` → groups, `/me*` / `/settings*` / `/dms*` / `/refer*` → you.
- `use-reduced-motion.ts` — thin wrapper on `window.matchMedia("(prefers-reduced-motion: reduce)")`, SSR-safe.
- `haptics.ts` — `hapticTap()` calling `navigator.vibrate?.(10)` inside a `typeof navigator !== "undefined"` guard, wrapped in `try/catch`, silent no-op otherwise.
- `mobile-island-tab.tsx` — icon-only when inactive; when active renders a `motion.div` **layoutId** pill (one shared id per side: `workshop-mobile-tab-pill-left` / `-right`) with the label revealed via width+opacity animation (`initial={{width:0,opacity:0}}` → `animate={{width:"auto",opacity:1}}`, `overflow-hidden`, `whitespace-nowrap`). Skips motion when reduced-motion is on. Adds `aria-current="page"` when active and `aria-label` for icon-only state. Min 44×44 touch target via `min-h-11 min-w-11` inner hit area.
- `mobile-action-island.tsx` — outer shell. `<nav aria-label="Primary">` fixed with `bottom:calc(env(safe-area-inset-bottom) + 12px)`, `z-[65]`, hidden `md:hidden`. Layout:
  ```
  [ Lounge  Collabs ] [ + ] [ Groups  You ]
  ```
  Uses a 3-column grid `grid-cols-[1fr_auto_1fr]` inside the pill so left/right groups are symmetric around the center slot; each side uses its own `LayoutGroup` so the active pill never appears to travel through the center. When composer is hidden (Wave 3), the center slot collapses (`w-0`) and the two side groups redistribute evenly.
- Replaces the JSX inside `src/components/mobile-nav.tsx` — keep the file as a thin re-export of `MobileActionIsland` so `__root.tsx` and any other importers keep working. Delete the legacy JSX; no commented-out code left behind.

Wave 1 preserves:
- Existing exclusion for individual Lounge rooms (`/^\/lounge\/[^/]+/`).
- Existing exclusion for logged-out visitors on `/u/*` and `/works/*`.
- Home behavior via the Workshop wordmark in `mobile-brand-header.tsx` (unchanged).

Wave 1 stops here — no composer button yet; the center slot is empty (side groups just span the full width).

## Wave 2 — Composer trigger + action menu

New files:

- `mobile-composer-trigger.tsx` — 48px circular button, `-mt-6` to rise above the island, `gradient-motion` background, `ring-4 ring-background`, `shadow-lift`. Renders a `Plus` icon that rotates 45° when open via `animate={{ rotate: open ? 45 : 0 }}` (spring stiffness 400, damping 30). On press: `whileTap={{ scale: 0.92 }}` and `hapticTap()`. Exposes `aria-expanded`, `aria-haspopup="menu"`, `aria-controls="mobile-composer-menu"`. When logged out, tapping navigates to `/login` instead of opening the menu.
- `mobile-composer-menu.tsx` — portal-rendered floating stack that sits above the island (`bottom:calc(env(safe-area-inset-bottom) + 84px)`). Three pill buttons stacked vertically, each rendered from `mobileCreateActions`, containing icon (in a rounded gradient chip), primary label, and dim secondary description. Each pill: `w-[min(320px,calc(100vw-32px))]`, `rounded-2xl`, `bg-background/90 backdrop-blur-xl border border-border shadow-lift`. Fullscreen backdrop `<button aria-label="Close create menu">` with `bg-background/40 backdrop-blur-sm` behind. Container has `role="menu"`; each action `role="menuitem"`. Motion: staggered (35ms) `initial={{opacity:0,y:8,scale:0.96}}` → `animate={{opacity:1,y:0,scale:1}}`, spring (stiffness 400, damping 30). Reduced-motion: plain fade only, no y/scale/stagger. Dismiss on: backdrop tap, `Escape`, action click, or when the mounting island's `open` becomes false.
- `mobile-action-island.tsx` gains `useState` for `composerOpen`, mounts trigger in the center slot and menu (via `<AnimatePresence>`) when open. Closes composer on route change via a `useEffect` on `pathname`.

Wave 2 preserves: no Plus/entitlement checks live here — each destination page owns them. Selecting Blog just navigates to `/me/blog` which already handles Plus / draft gates.

## Wave 3 — Route hardening + keyboard + clearance

- New `use-mobile-island-visibility.ts` returning `{ islandVisible, composerVisible, forceCloseComposer }`. Centralized rules:
  - `islandVisible = false` when pathname matches: `/^\/lounge\/[^/]+/`, `/login`, `/signup`, `/onboarding`, `/forgot-password`, `/reset-password`, `/checkout/return`, `/oauth/*`, `/redeem/*`, or (logged out AND `/u/*` or `/works/*`).
  - `composerVisible = false` on: `/works/new`, `/works/:slug/edit`, `/collab/new`, `/collab/:slug/edit`, `/me/blog/*` (editor pages), and any pathname matching `/edit` suffix.
  - `forceCloseComposer` fires when either flips to false.
- New `use-keyboard-open.ts` — subscribes to `window.visualViewport.resize` and returns `true` when `visualViewport.height < window.innerHeight * 0.85`. Falls back to `focusin`/`focusout` on inputs/textareas/contenteditable for browsers without visualViewport. When true: island slides fully off-screen (translateY 200%) and composer is force-closed.
- Replace scattered `pb-24` / hardcoded bottom paddings with a CSS variable declared in `src/styles.css`:
  ```css
  :root { --mobile-island-clearance: 0px; }
  @media (max-width: 767px) { :root { --mobile-island-clearance: calc(env(safe-area-inset-bottom) + 80px); } }
  ```
  Body/main gets a shared `pb-[var(--mobile-island-clearance)]` on mobile via a small helper class `.pb-mobile-island` also in `styles.css`. When the island is hidden on a route, the island component sets `document.documentElement.style.setProperty("--mobile-island-clearance", "0px")` via effect (and restores on cleanup). Keyboard-open state does the same to avoid doubled padding.
- Audit and remove now-redundant `pb-24 md:pb-0` from `gallery.tsx` and the `pb-[calc(env(safe-area-inset-bottom)+112px)]` on `index.tsx`; replace with the shared class. Individual Lounge routes already own their dock — they set the variable to 0 while mounted.

## Wave 4 — QA pass (no new code unless a bug is found)

Verification checklist (executed after Wave 3):
1. Typecheck (`bunx tsgo --noEmit`) and build.
2. Playwright pass at 320px, 390px, and 768px: home, lounge, individual lounge room, collab list, collab new, groups, group detail, `/me`, `/works/new`, `/me/blog`, `/settings`, logged-out `/u/:username`.
3. Verify: active pill animates within each side only; center + rotates to × and back; three floating action pills appear staggered; backdrop tap + Escape + action click all close; menu closes on route change; island hides on `/lounge/:id`; composer hides on `/works/new`; keyboard-open state (focus a textarea in `/me/blog/:id`) removes the island; reduced-motion preference kills spring animations; no duplicated bottom padding.

## Files touched (summary)
- **New**: `src/components/mobile-island/{index.ts,mobile-tabs-config.ts,mobile-action-island.tsx,mobile-island-tab.tsx,mobile-composer-trigger.tsx,mobile-composer-menu.tsx,use-active-tab.ts,use-mobile-island-visibility.ts,use-keyboard-open.ts,use-reduced-motion.ts,haptics.ts}`
- **Edited**: `src/components/mobile-nav.tsx` (becomes a re-export), `src/styles.css` (island clearance variable + `.pb-mobile-island`), `src/routes/gallery.tsx` and `src/routes/index.tsx` (swap ad-hoc bottom padding for the shared class).
- **Untouched**: `src/components/top-nav.tsx`, `src/components/mobile-brand-header.tsx`, `src/routes/__root.tsx` (already imports `MobileNav` — no import change needed).

## Constraints honored
No new routes or creation types. No Event creation in the mobile composer. No Plus logic inside navigation. Desktop Create menu untouched. Legacy 5-tab JSX removed, not commented. Lounge dock never overlapped. Composer never gated behind Plus. Framer Motion is already a dependency (used across the codebase) — no new package installs required.

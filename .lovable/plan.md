# Mobile navigation pass: hamburger header + a six-slot bottom island

## 1. Top bar: gear becomes a hamburger

The circled gear in the mobile header becomes a hamburger (menu) icon for signed-in members, matching the signed-out state which already uses one. Nothing else in the header changes: mail and bell stay where they are, and the menu contents stay the same (profile card, Your stuff, Explore, Refer, Settings, Sign out). Only the trigger icon and its label ("Menu") change.

## 2. Bottom island: fit every main flow

Today the island holds four labelled tabs (Groups, Collabs, Gallery, You) plus the composer, and the active tab expands to show its text label. Labels are what eat the width, so they're the thing to trade away.

New layout — six icon-only slots, composer in the middle:

```text
[ Groups ] [ Collabs ] [ Gallery ]  ( + )  [ Events ] [ Blog ] [ You ]
```

- Left group: Groups, Collabs, Gallery
- Center: composer (unchanged behaviour and order: Write a blog post, Post a Collab, Post to Gallery)
- Right group: Events, Blog, You (avatar)
- Still a floating, rounded, blurred island pinned above the safe area.

Active state without text: the sliding pill stays (it's the thing that makes the island feel alive), the icon goes to full ink with a heavier stroke, and a small dot sits under the active icon. Each slot keeps a 44px touch target and an `aria-label`, so screen readers still announce "Groups", "Blog", etc.

At 390px wide there's room for six 44px targets plus the 48px composer; icons compress to a slightly tighter horizontal padding on very narrow screens (<360px) rather than wrapping.

Profile stays exactly one tap away, as the rightmost avatar slot.

### If six feels too dense

The fallback is five slots — Groups, Collabs, `+`, Blog, You — with Gallery and Events promoted in the hamburger sheet. I'd build the six-slot version first since your ask is that every main flow lives in the island, and it's a small change to drop back.

## Technical notes

- `src/components/settings-menu-button.tsx`: swap the signed-in trigger icon from `Settings` to `Menu`, update `aria-label`.
- `src/components/mobile-island/mobile-tabs-config.ts`: extend `MobileTab["id"]` with `events` and `blog`; six entries, three per side, in the order above.
- `src/components/mobile-island/use-active-tab.ts`: add matchers for `/events` (and `/e/`) and `/blog`; keep `/me/blog` under `you` so the member dashboard doesn't light up the public Blog tab.
- `src/components/mobile-island/mobile-island-tab.tsx`: drop the animated width/opacity label span, keep the `layoutId` pill, add the active dot and stroke-weight change; tighten `px-3` to a responsive `px-2` so six slots fit.
- `src/components/mobile-island/mobile-action-island.tsx`: no structural change — the left/right groups already map over `side`, so the extra entries flow in. Verify the `grid-cols-[1fr_auto_1fr]` composer layout still centers with three-per-side.
- Composer config, visibility rules, haptics, and keyboard-hide behaviour are untouched.

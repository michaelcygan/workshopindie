## Goal
Make the Today tab chat behave like the Lounge chat on laptop screens: the composer input stays visible without scrolling, and the scrollable message list absorbs any overflow inside a fixed container.

## Change
In `src/components/group/group-today-tab.tsx`, on the `TodayChat` message scroller (currently `h-[calc(100vh-22rem)] min-h-[480px] max-h-[72vh]`), replace the height rule with the same clamp pattern used in the Lounge:

- Mobile/laptop: `h-[clamp(280px,42vh,460px)]`
- `xl:` (large desktop): `xl:h-[56vh]`

Slightly taller than the Lounge clamp because the Today tab has no bottom nav under it, but small enough that on a MacBook the header + tab bar + chat header + scroller + composer all fit above the fold.

Also remove the `min-h-[480px]` and `max-h-[72vh]` so the clamp is the single source of truth (min 480 was the direct cause of overflow on 13" screens).

No changes to mobile-specific styling (mobile view already fits — the min-h just wasn't harming it since the sidebar stacks below). No changes to the composer, aside column, or Fresh Collabs card.

## Verification
Confirm on a ~800px-tall viewport (typical MacBook) that the Send button/input row is visible without scrolling on the Today tab, matching the Lounge fix.
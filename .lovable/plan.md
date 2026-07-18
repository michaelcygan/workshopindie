# Today tab: better-designed chat + swipeable module rail

## Goal
Make the Today chat feel like a proper chat card (input pinned at the bottom, cleaner header/composer, comfortable message density), and stop letting the tall right sidebar dictate the chat height. Move the sidebar modules into a horizontal swipeable "rail" that sits underneath the chat as a rectangular strip.

## Layout change

Current (desktop):
```text
[ Chat (stretched tall)     ] [ Next event  ]
                              [ Recent collabs ]
                              [ Recent works ]
```

New (all breakpoints):
```text
[ Chat card — self-sized, input pinned bottom          ]
[ ← Next event | Recent collabs | Recent works →  swipe ]
```

- Single column at every width. No more `lg:grid-cols-[1fr_300px]`.
- The chat becomes a proper card with its own comfortable clamped height (roughly `clamp(360px, 52vh, 560px)` — same feel as Lounge), input always visible at the bottom, no dependence on sidebar height.
- Below the chat, a horizontal, snap-scrolling rail contains three rectangular module cards (Next event, Recent collabs, Recent works). Native touch swipe on mobile; on desktop, horizontal scroll with subtle left/right chevron buttons and scroll-snap. Each card is a fixed width (~300–340px) so 1 shows on mobile, 2–3 peek on wider screens.

## Chat card redesign
- Header stays compact: title "Today in {group.name}", presence bubbles, date/count chip on the right.
- Message list: comfortable spacing, avatar + name + timestamp on one row (as today).
- Composer pinned to the bottom of the card via flex layout, with:
  - Larger tap target, rounded input, subtle border, focus ring.
  - Character counter moved to a small muted label under/right of the input so it doesn't crowd the send button.
  - Send button remains a pill with icon, disabled state unchanged.
- Signed-out placeholder fills the same card body.

## Swipeable rail
- New small component (kept inside `group-today-tab.tsx` to stay scoped): `TodayModuleRail`.
- Wraps `GroupNextEvent`, `RecentCollabs`, `RecentWorks` in fixed-width cards inside an `overflow-x-auto snap-x snap-mandatory` container with `scroll-smooth`.
- Chevron buttons visible on `md+` when scrollable; hidden on touch.
- Each rail card keeps its existing content and links (no data changes).

## Files touched
- `src/components/group/group-today-tab.tsx` — restructure top-level layout, rework `TodayChat` card (flex column, pinned composer, clamped height), add local `TodayModuleRail`.

## Out of scope
- No changes to data fetching, RLS, presence, or mention logic.
- No changes to the individual sidebar modules' internals (only their outer wrapping/width).

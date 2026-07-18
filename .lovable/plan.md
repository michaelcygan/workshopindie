# Today tab: adjacent scenes in the rail + expandable chat

## 1) Adjacent scenes + more events in the module rail

The horizontal module rail below the chat currently shows 3 cards: Next event (1), Recent collabs, Recent works. Two changes:

- **Rename "Next event" → "Upcoming events"** in `src/components/group/group-next-event.tsx`. Fetch `limit(3)` instead of `limit(1)` and render up to 3 compact rows (cover thumb + title + day/time/relative). Empty state and "All events" link unchanged.
- **Add an "Adjacent scenes" card** as a 4th rail card in `src/components/group/group-today-tab.tsx`. Reuses the existing query from `src/components/adjacent-groups-rail.tsx` (extract the query into a small `useAdjacentGroups(groupId)` hook so both callers can share it) and shows the top 3 group names as tappable pills (avatar + name + member count), plus a small "See all" that scrolls to the full rail. Card hides itself when there are no adjacent groups.
- **Keep** the existing full `AdjacentGroupsRail` at the bottom of `src/routes/g.$slug.tsx` (unchanged) — it's shown across all tabs, and the compact rail card is a summary/entry point, not a replacement.

## 2) Expand-chat button in the chat header

The circled area is the right side of the Today chat header, next to the date chip.

- Add a small icon button (Maximize2 icon) with `aria-label="Expand chat"` immediately left of the date/count chip.
- Clicking opens a shadcn `Dialog` that renders the same `TodayChat` content in a large modal (roughly `max-w-3xl`, `h-[85vh]`), with a Minimize2 close button. Same messages, same composer, same presence bubbles, same mention popover — the only difference is the container height.
- Implementation: extract the current chat body (header + scroller + composer) into a `TodayChatBody` inner component that accepts a `height` prop or a variant flag. The outer `TodayChat` renders it in card mode (`clamp(360px,52vh,560px)`); the dialog renders it in fill mode (`h-full` inside `h-[85vh]` shell). No data refetching duplication — the dialog just mounts a second instance keyed by `group.id`; live realtime updates already keep both in sync since both subscribe to the same channel/query.
- Only shown to signed-in users (matches the existing signed-in gate for the composer).

## Files touched
- `src/components/group/group-next-event.tsx` — up to 3 upcoming events, rename to "Upcoming events".
- `src/components/adjacent-groups-rail.tsx` — export the query as `useAdjacentGroups(groupId)` and keep the existing rail using it.
- `src/components/group/group-today-tab.tsx` — add Adjacent scenes rail card; add expand-chat button and Dialog wrapper; extract `TodayChatBody`.

## Out of scope
- No schema changes.
- No changes to the bottom-of-page `AdjacentGroupsRail` layout.
- No changes to Recent collabs / Recent works cards.

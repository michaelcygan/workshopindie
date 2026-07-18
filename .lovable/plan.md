## Group "Today" tab: Who's here + chat height alignment

### 1. "Who's here" presence bubbles

Add a live avatar cluster in the "Today in {group}" header showing signed-in users currently viewing the tab.

- **New component** `src/components/group/today-presence-bubbles.tsx`
  - Stacked avatar cluster (up to 5 visible, `-space-x-2`), with a `+N` overflow chip
  - Tooltip on each avatar showing display name / handle
  - Accepts `groupId` prop; internally manages presence state
- **Realtime Presence wiring**
  - Channel key: `gtp-presence-${groupId}-${uniqueSuffix}` (unique suffix to avoid the postgres_changes-after-subscribe race we hit before)
  - Track `{ user_id, display_name, avatar_url, handle }` on `SUBSCRIBED`
  - Sync avatar list from `presenceState()` on `sync`/`join`/`leave`
  - Tear down channel on unmount
- **Integrate into** `src/components/group/group-today-tab.tsx` header, right side of the "Today in {group}" title row
- **Gating**: only render when the viewer is signed in (matches existing Today board signed-in-only rule); logged-out users see nothing
- **No DB / no migration** — presence is ephemeral

### 2. Chat container bottom alignment

The chat card currently stretches to match the taller right sidebar (Recent Collabs + Recent Works), leaving awkward empty space below the composer.

- In `src/components/group/group-today-tab.tsx`, add `self-start` to the chat `<section>` so it sizes to its content rather than filling the grid row
- Increase the desktop scroller clamp on the messages list from `xl:h-[38vh]` → `xl:h-[46vh]` so the card visually ends near the bottom of the Recent Collabs module (the red line in your annotation)
- Preserve existing mobile clamps unchanged

### Out of scope
- No changes to sidebar modules, chat composer, or message rendering
- No DB schema or RLS changes

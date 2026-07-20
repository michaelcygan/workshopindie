## Goal

Redesign the "What people are working on" section on the event page to use the existing `CollabPeek` / `WorkPeek` / `ProfilePeek` flow (already used in Lounge and Groups Today). Cards become smaller, quieter tiles that pop open the peek modal on tap — no need to cram title, chips, description, roles, avatar and RSVP into the card itself.

## Changes (scoped to `src/components/event-attendee-work.tsx`)

1. **Replace `CollabCard` / `WorkCard` with new local compact tiles**:
   - `CompactCollabTile` — square-ish cover (aspect-[4/3]), category chip top-left, "Open" dot top-right, title clamped to 2 lines in `text-sm`. Author avatar + name as a tiny footer row. Whole tile is a button that opens `CollabPeek`.
   - `CompactWorkTile` — square cover (aspect-square), single category chip, title clamped to 2 lines in `text-sm`, tiny author avatar chip in the corner overlay. Whole tile is a button that opens `WorkPeek`.
   - Both tiles: `rounded-2xl`, `border-border`, hover lift, `min-w-0`, no chip overlap since we surface only one chip (rest live in the peek).

2. **Denser grid** (cards are smaller now):
   - Fair mode: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` (was 1→2).
   - By-person expanded: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` for works, `sm:grid-cols-2 lg:grid-cols-3` for collabs.
   - Increase perUserCap slightly since tiles are compact (collabs 3, works 6 in fair; 4/8 in expanded).

3. **Peek wiring**:
   - Track `peekCollabId` / `peekWorkId` / `peekProfileId` state at the section level.
   - Render single `<CollabPeek>`, `<WorkPeek>`, `<ProfilePeek>` at the bottom (mirrors group-today-tab pattern).
   - `onCreatorClick` from Collab/Work peek → set `peekProfileId` (chained peek, same as Lounge).

4. **Remove the separate `AttendeeChip` row under each card** — author appears inside the tile footer and full attribution is in the peek. Keeps grid tight.

5. Keep the tab switcher, expand/collapse footer, and empty state unchanged.

## Files touched
- `src/components/event-attendee-work.tsx` — rewrite tile subcomponents, add peek state + modals.

No server function, schema, or other route changes.

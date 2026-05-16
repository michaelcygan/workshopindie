## Rework the Board (v1)

Drop tldraw drawing entirely (it crashes, and freehand isn't needed yet). Replace with a simple, robust pinboard where anyone in the room can drop:

- **Images** — paste a URL or upload a file (temp, room-scoped)
- **Sticky notes** — colored note with editable text
- **Link buttons** — a labeled button that opens a URL in a new tab
- **Text labels** — free-form text (a heading/caption, no background)

Everything is draggable on a shared canvas, syncs live between participants, and is wiped when the room empties (same lifecycle as today's whiteboard).

### What changes

```text
src/components/room-whiteboard.tsx   →   src/components/room-board.tsx   (new component, tldraw removed)
src/components/channel-view.tsx              (lazy-load RoomBoard instead of RoomWhiteboard)
src/components/media-panel.tsx               (label stays "Board"; same PenLine icon)
src/lib/room-views.functions.ts              (purge function now also deletes board items)
supabase/migrations/<new>.sql                (new instant_board_items table + trigger update)
```

`bun remove tldraw` to drop the dependency.

### Data model

New table `instant_board_items`:

- `room_id` (uuid, FK semantics to `instant_rooms.id`)
- `user_id` (uuid, creator — used for "your items" affordances)
- `kind` (text: `image` | `sticky` | `link` | `text`)
- `content` (jsonb — shape per kind, below)
- `x`, `y` (numeric, canvas coords) · `w`, `h` (numeric)
- `z` (int, stacking) · `rotation` (numeric, default 0)
- `created_at`, `updated_at`

Content shapes:
- `image`: `{ src, alt? }`
- `sticky`: `{ text, color }` (color = one of ~6 named tokens)
- `link`: `{ url, label }`
- `text`: `{ text, size? }` (size = sm/md/lg)

RLS: anyone present in the room (existing `instant_presence` check) can `SELECT`/`INSERT`; only the creator OR the room creator can `UPDATE`/`DELETE`. Admins can manage.

Realtime: enable `postgres_changes` on `instant_board_items` so every client gets inserts/updates/deletes live — no custom broadcast layer, no late-joiner snapshot dance.

Cleanup: extend the existing `tg_instant_presence_archive_empty` trigger to also `DELETE FROM instant_board_items WHERE room_id = OLD.room_id` when the last participant leaves. Image uploads keep using the existing `instant-whiteboard` storage bucket + `instant_whiteboard_assets` tracking table (no rename — minimizes churn, same purge path).

### UI

A single `<RoomBoard roomId userId />` component that fills the panel:

- **Toolbar** (top-left of the board): four buttons → Add image, Add sticky, Add link, Add text. Image opens a popover with "Paste URL" tab + "Upload" tab. Link opens a small inline form (URL + label). Sticky/text drop a default item near the toolbar.
- **Canvas**: an absolutely-positioned layer inside a scrollable container. Items are simple `<div>`s with `position: absolute` driven by their `x/y/w/h`. Drag = mouse/touch pointer events; on drag end, `UPDATE` the row (debounced ~150ms during drag so we don't spam writes).
- **Item chrome**: hover shows a tiny floating toolbar (move handle = whole card; delete = ✕; for sticky/text → inline edit; for link → edit URL/label; for image → no edit, just delete). Only the creator and the room owner see delete/edit.
- **Visual language**: use existing semantic tokens (`bg-surface`, `border-border`, `text-ink`, `text-ink-muted`). Sticky colors map to muted token-based palette (yellow/pink/blue/green/lavender/peach via `oklch` variables added to `src/styles.css` if missing).
- **Empty state**: subtle centered hint "Drop an image, sticky, or link to start."
- **Header strip**: keep the existing "Board · ephemeral" label; replace "Save PNG" with a small "Clear my items" overflow (host/admin also gets "Clear board").

No drawing tools, no shape picker, no z-index UI beyond "bring to front on drag start." Pan/zoom skipped for v1 — fixed canvas sized to the panel, items can overflow into a scrollable area.

### Sync mechanics (technical)

- On mount: `select * from instant_board_items where room_id = :roomId` → seed local state.
- Subscribe to postgres_changes for that `room_id`; merge INSERT/UPDATE/DELETE into local state.
- Local edits: optimistic update in state, then `upsert`/`update`/`delete` to DB. If the call fails, revert + toast.
- Drag: while dragging, only update local state; on `pointerup`, write final `x,y` once (and `z = max+1`).

### Out of scope (v2+)

- Freehand drawing / tldraw replacement
- Multi-select, group move, alignment guides
- Resize handles (items have sensible default sizes; stickies grow with text)
- Pan/zoom, infinite canvas
- Export to PNG
- Presence cursors on the board

### Migration steps

1. `bun remove tldraw`
2. Migration: create `instant_board_items` + RLS + realtime publication + extend trigger to purge items.
3. Build `src/components/room-board.tsx`.
4. Swap the lazy import in `channel-view.tsx`; delete `src/components/room-whiteboard.tsx`.
5. Update `purgeRoomWhiteboard` to also delete `instant_board_items` rows (storage purge stays as-is).

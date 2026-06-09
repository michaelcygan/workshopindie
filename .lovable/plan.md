## Audit summary

In the live room (`/workshop/$id`), the tools panel only shows two quick-enable buttons (suggested + Pinboard) in its empty state — the full "+ Tool" picker is hidden until *after* the first tool is enabled. That is why the screenshot shows just Outline + Pinboard.

Beyond the picker bug, the live room and the persistent Workshop are running two different tool sets:

| Tool | Live room (`instant_tools`) | Persistent Workshop |
|---|---|---|
| Pinboard | yes (primitive) | yes (primitive) |
| Outline / Docs | "Outline" = sectioned title+body list | **real rich editor** (`workshop_docs`) with realtime + comments |
| Drive (files + links) | missing | yes (`workshop_drive_files`, `workshop_drive_links`) |
| Tasks / List | missing | yes (`workshop_tasks`) |
| Shot List, Track List, Moodboard, Repo & Demo | yes (primitives) | not present as separate tools |
| Screen Share | not built (button just opens the room) | not built |
| Board (whiteboard) | `room-board.tsx` exists but unused; marked "soon" | not built |
| Recorder | not built | not built |

Promotion (`createCollabFromRoom`) copies `instant_tools` → `workshop_tools` 1:1, so it does NOT migrate live-room data into the richer persistent tables (Docs/Drive/Tasks). That gap gets larger once Docs becomes a real editor.

## Goals

1. Every tool that exists is reachable from the live room at creation — no hidden picker.
2. Replace "Outline" with **Docs** (the real collaborative editor), wired into the live room.
3. Bring **Drive** and a generalized **List** tool into the live room.
4. Surface Screen Share, Board, and Recorder as **Coming soon** tiles everywhere tools appear — visible, disabled, with a clear label — so users know they're on the roadmap.
5. Preserve user data through promotion to a persistent Collab.

## Plan

### 1. Fix the picker (small, high-impact)

`WorkshopToolsPanel` empty state currently renders only "suggested + Pinboard". Replace it with the full set of available tools as chips — each enable-able in one click — with the category-suggested one visually highlighted. Coming-soon tools render alongside, disabled, with a "Coming soon" pill.

### 2. Rename Outline → Docs, upgrade to the real editor

- Rename the `outline` preset label to **Docs** in `workshop-tools-panel.tsx` (icon stays `FileText`). Keep the underlying `tool_type` value `outline` in the DB to avoid a destructive enum migration; just relabel in the UI.
- In the live room, when the active tool is Docs, replace the tiny title+body form with the existing rich Docs editor currently in `src/routes/workshops.$slug.tools.$tool.tsx` (`<Docs />` component, backed by `workshop_docs`).
- New tables for the live-room Docs: `instant_docs` and `instant_doc_comments` mirroring `workshop_docs` / `workshop_doc_comments`, scoped to `room_id`. RLS: anyone in the room (via `is_room_member`) can read/write; only the author or host can delete.
- Extract the existing `<Docs />` component out of the route file into `src/components/workshop-docs-editor.tsx` and make it polymorphic via the same `ToolsScope` shim (`workshop_docs` vs `instant_docs`).

### 3. Add Drive to the live room

- New tables `instant_drive_files`, `instant_drive_links`, `instant_drive_file_comments` mirroring the `workshop_drive_*` set, scoped to `room_id`.
- Add a new private `instant-drive` storage bucket gated by RLS on the row.
- Extract the existing Drive component out of `workshops.$slug.tools.$tool.tsx` into `src/components/workshop-drive-panel.tsx`, made polymorphic via `ToolsScope`.
- Add a `drive` preset to `PRESETS` in `workshop-tools-panel.tsx`.

### 4. Generalize Tasks → List

- Rename UI label "Tasks" → **List**; description "A list — to-dos, tracks, shots, whatever you need."
- Replace the existing `shot_list` and `track_list` presets with a single `list` primitive that accepts title + optional body + optional URL, plus a `done` checkbox.
- Extend `instant_tool_items` with a nullable `done boolean` and a `position int` for ordering, then render a checkbox when `tool_type = 'list'`.
- Promotion path: copy `list` items into `workshop_tasks`.

### 5. Coming-soon tools (Screen Share, Board, Recorder)

These three are not yet built but are on the roadmap, so they get first-class placeholders rather than being hidden:

- Add `screen_share`, `board`, and `recorder` entries to `PRESETS` with their icons and one-line blurbs.
- In every tool picker (live-room empty state, "+ Tool" menu, persistent Tools hub), render them as **disabled chips/tiles with a "Coming soon" pill**. No enable action. Tooltip explains "Available in an upcoming release."
- Order them after the shipped tools so they don't distract from what works today.
- `room-board.tsx` is already built but unused. Recommendation: still mark Board as "Coming soon" in this pass (the existing component needs auth/RLS hookup, undo/redo, and persistence into a new `instant_board_*` schema before it ships). Tracked as the first follow-up.

### 6. Empty state copy + suggested mapping

Update `CATEGORY_DEFAULTS` so the suggested tool per category points at the new primitives:

- film → list (was shot_list)
- music → list (was track_list)
- writing → outline (Docs)
- build → repo_links
- visual → moodboard
- critique / business / coworking → outline (Docs)

Empty-state copy: "Spin up a shared tool — Docs, Pinboard, Drive, List, Moodboard, Repo & Demo. Add as many as you need."

### 7. Promotion (createCollabFromRoom)

Extend `src/lib/collab-workshop.functions.ts` so when a room promotes:

- `instant_docs` → `workshop_docs` (+ comments)
- `instant_drive_files` / `_links` → `workshop_drive_files` / `_links`
- `instant_tool_items` where `tool_type='list'` → `workshop_tasks`
- Existing `instant_tools` → `workshop_tools` flow stays for the lighter primitives (Pinboard, Moodboard, Repo & Demo).

### 8. Polish pass on existing flow

- Tooltip on each picker chip explaining the tool.
- After enabling a tool, auto-focus the first input.
- Realtime: add new `instant_*` tables to `supabase_realtime` publication and subscribe in the live room so multiple participants see updates without manual refetch.
- Mobile: collapse the tool tab strip into a horizontal scroll when > 4 tools are enabled.

## Out of scope (this turn — Coming soon in UI, follow-up implementation)

- Real Screen Share via `getDisplayMedia` wired into the existing WebRTC track set.
- Real-time Board built on top of the existing `room-board.tsx` with persistence + RLS.
- Recorder via `MediaRecorder` writing into the `instant-drive` bucket.

Tracked as the first three follow-up tasks after this lands.

## Technical notes

- **DB enum**: `tool_type` is `text`, so adding `'list'`, `'drive'`, `'screen_share'`, `'board'`, `'recorder'` is a one-line change with no enum migration. We keep `outline` as the stored value behind the Docs label.
- **Component extraction**: the Docs and Drive sub-components live inline inside `src/routes/workshops.$slug.tools.$tool.tsx` (~700 LOC). Extracting them with a `scope: ToolsScope` prop unblocks both surfaces.
- **Migrations** (one combined file):
  - `instant_docs`, `instant_doc_comments`
  - `instant_drive_files`, `instant_drive_links`, `instant_drive_file_comments`
  - `instant-drive` storage bucket
  - Add `done boolean`, `position int` to `instant_tool_items`
  - GRANTs + RLS scoped through `is_room_member(room_id, auth.uid())`
  - New tables added to `supabase_realtime` publication
- **`createCollabFromRoom`**: extend the copy step in one server function, wrapped in a single transaction.

## Files touched

- `src/components/workshop-tools-panel.tsx` — picker fix, new presets including Coming soon entries, List checkbox rendering, Docs/Drive slot rendering
- `src/components/workshop-docs-editor.tsx` (new, extracted)
- `src/components/workshop-drive-panel.tsx` (new, extracted)
- `src/routes/workshops.$slug.tools.$tool.tsx` — swap inline impls for the extracted components
- `src/routes/workshops.$slug.tools.tsx` — Screen Share / Board / Recorder rendered as Coming soon tiles
- `src/lib/collab-workshop.functions.ts` — extend promotion copy
- `supabase/migrations/<new>.sql` — tables, RLS, GRANTs, storage bucket, realtime publication

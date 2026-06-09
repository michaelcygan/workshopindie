## Goal

Make **Board** a fully shipped tool alongside Docs / Drive / List / Pinboard / Moodboard / Repo & Demo / Screen Share / Recorder, then push the entire Tools flow over the finish line for launch.

`src/components/room-board.tsx` already exists (4000×3000 realtime whiteboard with images, stickies, links, text, zoom, drag, storage upload) but is **not mounted anywhere** — `channel-view.tsx` explicitly notes "Board moved to Workshop Tools" and never imports it. So Board is 90% built; we just need to wire it.

---

## 1. Board — promote from "Coming soon" to shipped

### 1a. Make RoomBoard polymorphic (instant + persistent)

Today RoomBoard takes `roomId` and writes to `instant_board_items` + `instant-whiteboard` storage. Mirror the Docs / Drive scope pattern:

```ts
export type BoardScope =
  | { kind: "persistent"; workshopId: string }
  | { kind: "instant"; roomId: string };
```

Add a `workshop_board_items` table that mirrors `instant_board_items` 1:1 (kind, content jsonb, x/y/w/h/z/rotation) plus `workshop-whiteboard` private storage bucket, with RLS scoped to `is_workshop_member`. Leave the existing unused `workshop_board_assets` table alone (it's referenced by sweep + types but nothing reads/writes it).

Refactor `room-board.tsx` to switch table/bucket/realtime-channel/parent-col based on scope. No UX changes.

### 1b. Wire Board into both Tools surfaces

- **Live room (`workshop-tools-panel.tsx`)**: drop `board` from `ComingSoonToolType`, remove `comingSoon: true`. When a board tool is enabled, render `<RoomBoard scope={{kind:'instant', roomId}} fullscreen />` inline (same expand affordance as Drive panel).
- **Persistent workshop (`workshops.$slug.tools.tsx`)**: remove the `soon: true` flag on the Board card, point its `action` at a new route `/workshops/$slug/tools/board` that renders RoomBoard with `{kind:'persistent', workshopId}`.

### 1c. Promotion

In `createCollabFromRoom` (`src/lib/collab-workshop.functions.ts`), copy `instant_board_items` rows → `workshop_board_items` and re-upload referenced storage objects from `instant-whiteboard` → `workshop-whiteboard` (keys rewritten in the content payload). Same pattern already used for docs / drive / list.

---

## 2. Tools flow — launch-readiness pass

A focused pass to fix the rough edges before launch. No new tools beyond Board.

### Functional fixes
- **Tool tray consistency**: live-room tool chips and persistent tool cards currently list tools in different orders and with slightly different copy ("Tasks" card vs "List" chip). Unify on the live-room labels (Docs, Pinboard, List, Drive, Moodboard, Repo & Demo, Screen Share, Recorder, Board) and the same icon set across both surfaces.
- **Empty states**: every tool gets a one-line empty state + a single "Add your first…" CTA (Docs already has this; Pinboard / List / Moodboard / Repo & Demo / Drive / Board need it).
- **Realtime presence**: surface "N people viewing" on each tool panel using `instant_presence` (live room) and a lightweight workshop presence channel (persistent).
- **Delete confirmation**: tools currently delete on single click. Add a confirm step on Tool deletion (items can stay one-click + undo toast).
- **Mobile**: tool tray collapses to a bottom sheet under 640px; Board enters single-finger pan / two-finger zoom mode; Screen Share gracefully degrades with a "Desktop only on iOS Safari" notice.

### Polish
- **Keyboard shortcuts**: `⌘K` opens tool picker, `1–9` switch active tool, `⌘S` saves Docs (already wired), `Esc` closes Board fullscreen.
- **Promotion preview**: before `createCollabFromRoom` runs, show a modal that lists exactly what will be copied (X docs, Y drive links, Z list items, N board items) so hosts know what survives.
- **Toast hygiene**: replace ad-hoc `toast.info("Coming soon")` strings — there should be zero "coming soon" strings left after this pass.
- **A11y**: every tool chip / card gets a proper `aria-label`; Board canvas items get `role="button"` + keyboard nudge (arrow keys move selected item by 8px).

### QA checklist (run before declaring launch-ready)
1. Create instant room → enable each of the 9 tools → add content → reload → content persists per tool.
2. Promote room to Collab → verify docs, drive links, list items, **and board items** survived.
3. Two-browser test: realtime sync on every tool including Board.
4. Mobile Safari + Chrome: tool tray, Board pan/zoom, Screen Share fallback, Recorder consent dialog.
5. RLS smoke: non-member cannot read any `workshop_board_items` row via direct query.

---

## Technical details

**New migration** (`20260609_board_persistent.sql`):
- `CREATE TABLE public.workshop_board_items` mirroring `instant_board_items` with `workshop_id` FK + `is_workshop_member` policies + GRANTs to authenticated/service_role + add to `supabase_realtime` publication + `tg_set_updated_at` trigger.
- `storage.create_bucket('workshop-whiteboard', private)` with member-only RLS on `storage.objects`.

**Files changed**:
- `supabase/migrations/20260609_board_persistent.sql` (new)
- `src/components/room-board.tsx` (scope refactor)
- `src/components/workshop-tools-panel.tsx` (board chip live, tray order, empty states, presence, delete confirm, mobile)
- `src/routes/workshops.$slug.tools.tsx` (board card live, copy unification)
- `src/routes/workshops.$slug.tools.board.tsx` (new route)
- `src/lib/collab-workshop.functions.ts` (board promotion)
- `src/integrations/supabase/types.ts` (regenerated after migration)

---

## Out of scope (intentionally deferred)
- Multi-user cursors on Board (the realtime data sync is enough for v1).
- Board export to PNG.
- Recorder multi-party mixing via Cloudflare Stream.
- Screen-share annotation overlay.

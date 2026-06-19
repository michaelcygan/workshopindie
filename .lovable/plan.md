# Editable room note — first thought / instant context

## Concept
Repurpose the per-user "Welcome" banner above chat (`src/components/workshop-chat-welcome.tsx`) as the room's **first thought** — a shared, in-room editable note that sets context for everyone filtering in.

- **No Host room** (`host_user_id IS NULL`, `kind = 'lounge'`, no `workshop_id`): any present participant can edit / clear.
- **Hosted room** (host present, or workshop-paired): only the host can edit.
- **Closed/empty state**: a tiny `+ Set the first thought` chip for whoever can edit; nothing at all for read-only viewers.

## What replaces the current welcome
The greeting copy ("This is your Workshop. Talk shop…") goes away — it was a one-time welcome and is the same on every room. The first-run education can move to a Workshop docs/intro surface later (out of scope here). The new banner reads as content, not chrome:
- empty: a soft `+ Set the first thought` pill, full-width-but-restrained, in the same slot above chat.
- set: avatar of who wrote it · the note · subtle edit/clear affordance if you can edit.

## States

| Viewer | Note empty | Note set |
|---|---|---|
| Can edit | `+ Set the first thought` chip | Note visible · pencil + clear on hover |
| Read-only | nothing rendered | Note visible · no controls |

Inline editing — click the chip or pencil → textarea swap with `Save` / `Cancel`. 280-char max, single short paragraph, no formatting. Optimistic save with rollback on error.

## Data

Add to `instant_rooms`:
- `note text` (nullable)
- `note_updated_at timestamptz`
- `note_updated_by uuid references auth.users(id) on delete set null`

Two security-definer RPCs (so we can keep RLS strict and centralize the open-vs-hosted rule):
- `set_room_note(_room_id uuid, _text text)` —
  - if `host_user_id IS NOT NULL` → caller must be host
  - else (No Host lounge, no `workshop_id`) → caller must be present in the room (heartbeat < 60s)
  - workshop-paired rooms: caller must be the Workshop's host
  - writes `note`, `note_updated_at = now()`, `note_updated_by = caller`; empty/whitespace clears the note
- (No separate "clear" RPC — passing empty/null to `set_room_note` clears it.)

No RLS policy change needed for direct writes; the column update goes only through the RPC, which is `SECURITY DEFINER` with explicit auth checks. The column is read via the existing `["instant-room", id]` query (already polled every 5s), so other participants see changes within a few seconds without realtime wiring.

## Files

- **Migration** — add the three columns, create `set_room_note`, GRANT EXECUTE to `authenticated`, REVOKE from `PUBLIC`/`anon`.
- **`src/lib/host-room.functions.ts`** — new server fn `setRoomNote({ roomId, text })` calling the RPC via `context.supabase`.
- **`src/components/workshop-chat-welcome.tsx`** — rename internally / repurpose, or replace with a new `room-note-banner.tsx`. Recommend the latter for clean diff; remove the old import sites and the localStorage dismiss key.
- **`src/routes/workshop.$id.tsx`** — extend the `instant-room` query to select `note`, `note_updated_at`, `note_updated_by`; render `<RoomNoteBanner roomId={id} room={room} canEdit={…} />` where the welcome banner used to live; compute `canEdit` as `isHost || (isLeaderless && !room.workshop_id && viewerIsPresent)`.

## Out of scope
- No edit history / audit feed.
- No realtime subscription — relies on the existing 5s poll.
- No moderation/profanity check beyond the existing client-side trim/length cap (matches current `setRoomFocusMessage`).
- Existing `focus_message` (header strip, host-only) stays as-is — different surface, different purpose (an active focus prompt vs. a passive context note). They can coexist; we can merge later if you decide they're redundant.

## Open question
Should I leave `focus_message` (the host-only header strip from `setRoomFocusMessage` / `FocusStrip`) alone, or fold it into this new "first thought" so there's only one editable string per room? I recommend leaving it for this pass — they target different moments (header pin vs. above-chat context) and merging is reversible later.

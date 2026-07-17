## Lounge: replace "Welcome pin" with per-message pinning

Simplify to a single pinned chat message that lives at the top of the chat stream. No dedicated welcome banner surface.

### Behavior
- Any signed-in user present in the room can pin any message from that room's chat. Pinning **replaces** the current pin (one at a time).
- Only the user who set the pin (the "pinner") can unpin it. If they leave/return, they can still unpin. Others see the pin but no unpin control.
- If the pinned message is deleted or its author leaves the room, the pin auto-clears via `ON DELETE SET NULL`.
- Pinning UI: on hover of a message (desktop) and via a long-press / kebab (mobile) — small pin icon appears next to the existing reaction button. Toast confirms.

> Interpretation note: "a user can only unpin their message" — I'm reading this as *the pinner can unpin*, not *the message author*. Simpler to reason about and prevents griefing (someone pinning your message and you being unable to remove your own pin). Say the word if you meant author-only.

### UI
- **Remove** `RoomNoteBanner` from `channel-view.tsx`. Delete the component file (no other references).
- **New** `PinnedMessage` component rendered as the first item inside the chat scroll container (above the `<ul>` of messages, inside the same scroll area so it scrolls with content — matches the "top message, rest fade below" ask).
  - Visual: subtle `bg-surface-2/60 border border-border rounded-2xl` block with a small pin icon + author avatar + name + message body (uses existing `MessageBody`/`RenderLinks` so mentions and normalized links stay live). Timestamp muted. If the current user is the pinner, an `X` unpin button on the right.
  - When no pin exists → renders nothing. No CTA, no dashed placeholder, no "· CC BY-SA" chip.
- Per-message pin action:
  - Desktop: adds a pin icon into the existing `flex gap-1` action row next to `ReactionAddButton` (visible on hover with the rest).
  - Mobile: same row, always slightly visible (opacity-60) so it's reachable without hover.
  - When the message is the current pin, the icon flips to "unpin" (only clickable by pinner) and shows as filled/primary.

### Data
Migration:
```sql
ALTER TABLE public.instant_rooms
  ADD COLUMN pinned_message_id uuid REFERENCES public.instant_messages(id) ON DELETE SET NULL,
  ADD COLUMN pinned_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN pinned_at timestamptz;
```
No new table needed — single pin per room lives on the room row. Realtime already publishes `instant_rooms`, so all clients update.

RLS: keep existing `instant_rooms` update policies. Add a permissive policy for pin-only updates: authenticated users present in the room may `UPDATE` these three columns when either (a) setting a new pin, or (b) clearing when `pinned_by_user_id = auth.uid()`. Enforced via a `SECURITY DEFINER` RPC to keep the check server-side:

```sql
CREATE OR REPLACE FUNCTION public.set_room_pin(_room uuid, _message uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM instant_presence WHERE room_id=_room AND user_id=auth.uid()) THEN
    RAISE EXCEPTION 'not in room';
  END IF;
  IF _message IS NULL THEN
    UPDATE instant_rooms SET pinned_message_id=NULL, pinned_by_user_id=NULL, pinned_at=NULL
      WHERE id=_room AND pinned_by_user_id=auth.uid();
    IF NOT FOUND THEN RAISE EXCEPTION 'only the pinner can unpin'; END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM instant_messages WHERE id=_message AND room_id=_room) THEN
      RAISE EXCEPTION 'message not in room';
    END IF;
    UPDATE instant_rooms SET pinned_message_id=_message, pinned_by_user_id=auth.uid(), pinned_at=now()
      WHERE id=_room;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.set_room_pin(uuid, uuid) TO authenticated;
```

### Server function
Add `setRoomPin(roomId, messageId | null)` to `src/lib/instant-rooms.functions.ts` (or nearest existing file) using `requireSupabaseAuth` and `context.supabase.rpc('set_room_pin', ...)`. Invalidate `["instant-room", roomId]` and the room note query key on success.

### Files changed
- `supabase/migrations/<ts>_room_pin.sql` — new columns + RPC + grants.
- `src/lib/instant-rooms.functions.ts` — new `setRoomPin` server fn (or new file `src/lib/room-pin.functions.ts` if there's no natural home).
- `src/components/channel-view.tsx` — remove `RoomNoteBanner` import + render (line 29 / 1010); extend the room query to select `pinned_message_id, pinned_by_user_id`; render new `<PinnedMessage>` above the message `<ul>`; add pin/unpin action in the per-message row.
- `src/components/pinned-message.tsx` — new component.
- `src/components/room-note-banner.tsx` — delete.
- `src/lib/host-room.functions.ts` — leave `setRoomNote` (it may still be referenced elsewhere for workshop notes); confirm via grep and only prune the `note`-related bits touched here if unused.

### Out of scope
- No changes to workshop-side notes or the `focus_message` field.
- No changes to Links/Gallery/Collabs tabs.
- No mobile bottom sheet layout changes beyond the message row action addition.

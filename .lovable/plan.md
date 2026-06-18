## Goal
Make the Workshop chat feel like a real chat surface: people can tag each other with `@handle` and react to messages with emoji.

## Scope (quick pass)
1. **@mentions** — typeahead while typing `@`, highlight rendered mentions, ping the tagged user.
2. **Reactions** — hover/long-press a message → emoji picker (small fixed set + "more"), counts shown inline, click to toggle your own.
3. Everything live for all participants via Realtime.

Out of scope (future passes): threaded replies, edit/delete, pinned chat messages, rich media attachments, DMs from chat.

---

## UX

**Mentions**
- Typing `@` in the composer opens a small popover anchored above the input.
- Popover lists current room participants (from `presence`), filtered by display_name/username as the user types.
- Arrow keys + Enter / click to insert `@username` (a space follows).
- In rendered messages, `@username` becomes a subtle chip — clicking opens that user's profile peek.
- If you're tagged, you get:
  - A soft inline highlight on the message (left accent border + tinted bg).
  - A toast if the chat panel isn't focused.
  - A notification row (kind `chat_mention`) so it shows in the bell, respecting `notification_preferences.inapp_workshop_updates`.

**Reactions**
- Hover a message (or long-press on mobile) → small floating bar with 6 quick emoji (👍 ❤️ 😂 🎉 🔥 👀) and a `+` for the full picker.
- Below the message body, reaction pills render as `🔥 3`. Your own reactions are visually filled; click to remove. Click an empty pill to add.
- Updates stream live to everyone in the room.

---

## Technical plan

### DB migration
- New table `instant_message_reactions`:
  - `id uuid pk`, `message_id uuid → instant_messages on delete cascade`, `user_id uuid → auth.users`, `emoji text`, `created_at timestamptz default now()`
  - `unique (message_id, user_id, emoji)`
  - GRANTs: `select, insert, delete` to `authenticated`; `all` to `service_role`.
  - RLS: select if user is present in the parent message's room (same pattern as `instant_messages`); insert/delete only own rows AND must be present in room.
  - Add to `supabase_realtime` publication.
- Add column `instant_messages.mentions uuid[] not null default '{}'` so we can index/filter mention pings without re-parsing bodies server-side.
- New notification kind `chat_mention` (no schema change — `notifications.kind` is text/payload).

### Server function (`src/lib/chat.functions.ts`, new)
- `sendChatMessage({ roomId, body, mentions })` — requireSupabaseAuth:
  - Validate length (≤1000), validate caller is in `instant_presence` for the room.
  - Validate each mentioned user is currently present in the room (drop unknowns silently).
  - Insert message with `mentions` array.
  - For each mentioned user (excluding self), insert one `notifications` row (`kind: 'chat_mention'`, entity_type `instant_room`, entity_id roomId, payload: actor name + snippet + message_id), respecting `inapp_workshop_updates`.
- Keep reactions client-side direct (insert/delete on `instant_message_reactions`) — RLS does the work.

### Client (`src/components/channel-view.tsx` + small new pieces)
- New `src/components/chat-mention-input.tsx`:
  - Wraps the textarea; tracks `@` token, renders participant popover from current `presence` list.
  - On submit, extracts mention usernames → resolves to user ids → calls `sendChatMessage`.
- New `src/components/chat-message-reactions.tsx`:
  - Renders pills + hover/long-press emoji bar.
  - Subscribes (via parent) to reactions for currently rendered messages.
- In `channel-view.tsx`:
  - Replace direct `supabase.from("instant_messages").insert(...)` with `sendChatMessage` server fn.
  - Initial load: also fetch `instant_message_reactions` for the last N messages and group by `message_id`.
  - Realtime: add a second subscription on `instant_message_reactions` filtered by `room_id` (joined via message); simplest is filter by message ids we know — or add a `room_id` denormalized column. **Decision:** add `room_id uuid` on `instant_message_reactions` (set via trigger from parent message) so Realtime can filter cheaply.
  - Render mentions: parse `@username` tokens against `profileLookup`; substitute with chip component.
  - If a new message arrives where `user.id ∈ mentions`, highlight + toast (only if chat panel not focused).

### Notifications
- `notifications-bell` already renders generic rows by `kind`. Add a small renderer/label for `chat_mention` → "X mentioned you in {room title}" linking to `/workshop/$id`.

---

## Files

**Created**
- `supabase/migrations/<ts>_chat_mentions_reactions.sql`
- `src/lib/chat.functions.ts`
- `src/components/chat-mention-input.tsx`
- `src/components/chat-message-reactions.tsx`

**Edited**
- `src/components/channel-view.tsx` (compose with new pieces, reactions state, mention highlight)
- `src/components/notifications-bell.tsx` (label for `chat_mention`)
- `src/integrations/supabase/types.ts` (regenerated automatically by migration)

---

## Open questions (will assume defaults unless you say otherwise)
- Default emoji set: 👍 ❤️ 😂 🎉 🔥 👀 — OK?
- Mentions only suggest **people currently in the room** (not all followers). OK?
- Mention notification fires even if the tagged user is currently in the room. OK?

# Friends + Online Presence (v1)

A low-key sticky-loop feature: a "Friends" list of mutual follows with an online dot, used to invite people into Workshops — both as a "start a Workshop with…" entry point and as an in-Workshop "invite mutuals who are online".

## Scope (build)

### 1. Mutual-follow friends list
- New helper `getFriends()` in `src/lib/network.functions.ts` (auth'd server fn). Returns mutuals: users where `follows(a→b)` AND `follows(b→a)` exist for `auth.uid()`. Hydrates profile (name, username, avatar, headline) + `online` boolean + `last_active_at`.
- New route `src/routes/me.friends.tsx` (under `_authenticated`): simple list, online dot, "Invite to Workshop" button per row, empty state ("Follow people back to build your friends list").
- Surface entry: small "Friends" link in the existing `me.*` nav / profile menu. Not promoted to primary nav.

### 2. Global online signal
- Add `profiles.last_active_at timestamptz` (migration).
- Lightweight heartbeat: a `pingPresence()` server fn called every 60s from `__root.tsx` while a session exists (visibility-aware: pause when tab hidden).
- "Online" = `last_active_at > now() - 2 minutes`. Reuse for the friends list and for any future "online" badges.
- Privacy: a `profiles.show_online` boolean (default true) with a toggle in `settings.tsx`. When false, `getFriends` returns `online: false` for that user and skips the dot.

### 3. "Start a Workshop with…" invite from friends list
- Each friend row has an "Invite to Workshop" button → opens a small picker of the current user's active/upcoming Workshops they host (reuses existing host query). Pick one → inserts into `workshop_join_invites` (already exists) and fires the existing notification path.
- If the user has no hostable Workshop, button becomes "Start a Workshop" → routes to `/workshops/new` with the invitee id in search params; on create, auto-issue the invite.

### 4. In-Workshop "Invite mutuals" panel
- Inside `src/routes/workshop.$slug.tsx` host controls, add an "Invite friends" section: list of mutual follows sorted online-first, with a one-tap invite button per row that writes to `workshop_join_invites` (with `source_room_id` if invoked from a lobby room).
- Filter out users already invited / participants. Show a subtle "Online now" cluster at the top.

## Out of scope (deferred)

- Friend requests / acceptances (we're piggy-backing on mutual follows; no new relationship type).
- DM / chat threads between friends.
- Push or email notifications for "friend just came online" — only the existing workshop-invite notification fires.
- Group invite flows (Workshops only for v1).
- Per-friend muting or blocking beyond the existing `user_blocks` table.

## Technical notes

- Migration: `ALTER TABLE profiles ADD COLUMN last_active_at timestamptz, ADD COLUMN show_online boolean NOT NULL DEFAULT true;` + index on `last_active_at`. No new tables, no new RLS surface — `profiles` already has public-read for these safe columns.
- `pingPresence` writes `last_active_at = now()` for `auth.uid()` only; cheap UPDATE, no upsert needed.
- `getFriends` does one query for mutuals (self-join on `follows`) then one `profiles` hydrate; capped at 200 friends for v1, sorted online-first then by display name.
- Workshop invite insert reuses `workshop_join_invites` unique `(workshop_id, invitee_user_id)` constraint — duplicate clicks are no-ops.
- No realtime subscription on presence in v1: page-load freshness is fine. Workshop panel can poll every 30s while open.

## Files touched

- new: `src/routes/me.friends.tsx`, `src/components/friend-row.tsx`, `src/components/invite-to-workshop-dialog.tsx`
- edited: `src/lib/network.functions.ts` (getFriends, pingPresence, inviteFriendToWorkshop), `src/routes/__root.tsx` (heartbeat), `src/routes/settings.tsx` (show_online toggle), `src/routes/workshop.$slug.tsx` (Invite friends panel), `src/components/app-nav` or profile menu (Friends link)
- migration: add `profiles.last_active_at`, `profiles.show_online`

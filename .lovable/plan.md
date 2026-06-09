# Matchmaker audit — align with the current Workshop build

The matchmaker (`Drop in` on `/workshop`) was written before host-created rooms, visibility settings, mutual-notify, and blocks. It currently can route strangers into mutuals/invite rooms and ignores who you follow. We'll fix routing, add a "follow" preference, and add a soft nudge so first-in users don't sit alone.

## Goals

1. Never auto-route a stranger into a host's private (`mutuals` / `invite`) room.
2. When multiple open rooms have seats, prefer rooms hosted by someone the viewer follows.
3. Respect blocks both ways — never match into a room with a blocked party present.
4. When a brand-new room spawns with only the viewer in it, immediately surface a "Waiting for others — share this" card so they don't bounce.
5. Keep the existing host flow, Live rail, and mutuals notify intact.

## Changes

### 1. SQL — visibility + follow-aware matchmaker

Update the two RPCs used by Drop in. Both currently `ORDER BY live_count DESC, created_at ASC`. New logic:

- `WHERE r.visibility = 'open'` (private host rooms are never matchmaker targets).
- Exclude rooms with any live presence by a user in `blocked_user_ids(_viewer)`.
- Add an `ORDER BY` boost: `public.is_follow(_viewer, r.host_user_id) DESC` (true first), then existing fullest-first ordering.
- Need a small `is_follow(_a, _b)` SECURITY DEFINER helper (one row in `follows`); `is_mutual_follow` already exists.

Files: new migration with updated `join_lounge(_user_id)` and `join_medium_lounge(_user_id, _medium)`, plus `public.is_follow`.

### 2. Server fn — pass the viewer (already does) + keep behavior

`joinLounge` / `joinMediumLounge` already forward `userId`. No signature change. Update the JSDoc to say "open rooms only, with a follow-preference boost".

### 3. UI — copy + "waiting" card

`src/routes/workshop.index.tsx`:
- Update the Drop-in subhead: "Matchmaker drops you into an open Workshop with a seat — and prefers rooms hosted by people you follow."
- After a successful drop, if the resulting room's `live_count === 1` (just you) on first load of `/workshop/$id`, show a one-time "Waiting for others" card.

`src/routes/workshop.$id.tsx`:
- When the live presence count is exactly 1 and the viewer is that one, mount a new `<WaitingForOthersCard />` overlaying the empty state of the participant strip.
- Card has: title "You're first in — share to fill the room", Copy link button (re-uses share URL), and "Ping mutuals" button that calls a new tiny server fn `pingMutualsForRoom({ roomId })` which reuses the existing `notifyMutualsOnHost` path (rate-limit 1 / 30 min applies). Hides after a second participant joins or after dismissal (sessionStorage `wf:waiting-dismissed:<roomId>`).

### 4. Server fn — `pingMutualsForRoom`

New entry in `src/lib/instant.functions.ts`:
- Auth-protected, input `{ roomId }`, verifies the caller is the host of an active lounge room, then calls the existing `notifyMutualsOnHost` helper (refactor it to accept an "already-built" caller path, or just call inline with the same shape).

### 5. Tiny component

`src/components/waiting-for-others-card.tsx` — Copy link + Ping mutuals + dismiss; uses `sonner` for confirmation.

## Out of scope

- Auto-merge of two empty same-medium rooms (you picked the lighter nudge).
- Changing the cap of 5 or the existing host privacy dialog.
- Touching the Live rail (already viewer-scoped via `list_active_instant_rooms`).

## Technical notes

- `list_active_instant_rooms` already enforces visibility per viewer — Live rail is fine.
- Blocks helper `blocked_user_ids(_viewer)` exists; we'll join against `instant_presence` filtered to the live cutoff to exclude rooms with a blocked party currently present.
- The new follow-preference boost is a stable sort tiebreaker; matchmaker still respects the "fullest first" rule so people cluster.

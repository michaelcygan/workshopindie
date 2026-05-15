## Goal
Fix the broken Lounge room and tighten the drop-in flow so users always enter live, can toggle mute/camera inside, and get auto-dropped if they go quiet.

## 1. Fix the "cannot add `presence` callbacks after `subscribe()`" error

Root cause: `useMediaRoom` opens a *lurker* channel named `media:${roomId}` in one effect, then `joinWithMode` opens **a second channel with the same name** for signaling. Supabase Realtime returns the same channel instance the second time, but it is already `SUBSCRIBED`, so the second `.on("presence", …)` registration throws. React 19 strict-mode double-mounting also triggers this on first paint.

Fix: give the two channels distinct names and guard against double-subscribe.
- Rename the always-on count subscription to `media-lurker:${roomId}` (presence key `lurker`).
- Keep the join/signaling channel as `media:${roomId}` (presence key = `myId`).
- Track subscription state with a ref so the lurker effect bails if the channel was already subscribed (defensive against strict-mode).
- On `leave()`, also clear the channel ref synchronously before `removeChannel`.

## 2. Auto-join media when the room page loads

The user already passed pre-flight + got a permission grant. Reading `?mode=voice|video` should drive an immediate `media.setMode(mode)` once on mount of `/instant/$id`. Remove the "Quiet right now / Voice / Video" chooser inside `MediaPanel` — once inside the room, you are always live.

- `instant.$id.tsx`: read `Route.useSearch().mode` (default `"voice"`), pass it to `<ChannelView initialMode>`.
- `ChannelView`: forward `initialMode` and call `media.setMode(initialMode)` once when `media` is unjoined and the room is ready.
- If `setMode` fails (perm revoked between pre-flight and join), toast and route back to `/instant`.

## 3. Strip the in-room mode chooser; keep mute / camera-off / Exit

In `MediaPanel`, when joined:
- Remove the Voice/Video segmented chip and the "Quiet right now" pre-join card.
- Show four controls: **Mic mute**, **Camera on/off** (only when on video, also a "Turn camera on" entry from voice), **Exit** (replaces "Leave").
- "Camera on/off" toggles the existing `localStream` video track without tearing down peer connections.
- "Exit" calls `media.leave()` then `router.navigate({ to: "/" })`.

Add a small `setCameraEnabled(on: boolean)` to `useMediaRoom`:
- If joining `video` from `voice`: tear down stream once and re-acquire with video (existing path via `setMode("video")`).
- If toggling within `video`: flip `track.enabled` on the existing video track — no renegotiation, no PC churn.
- Mirror this for mute (already in place; just keep `track.enabled = false`).

## 4. Inactivity guard: 2-min muted → warning → 1-min → auto-exit

Add a `useEffect` in `ChannelView` (or `useMediaRoom` exposes a hook) that watches "is the user contributing media?". The user is **inactive** when:
- mic is muted **AND** (mode is `voice` OR camera is off in `video`).

Behavior:
- Inactive ≥ 2 min → show a non-blocking dialog: "Still here? You've been muted for 2 minutes. Tap to stay." with a "Stay" button.
- 1 min after warning shown with no action and still inactive → call `leave()` + navigate to `/instant` with a toast: "Dropped from the Lounge — you went quiet."
- Any of {unmute, turn camera on, click Stay, send a chat message} resets timers.

Implement with two timers (`setTimeout`) in a single effect that re-fires whenever `muted`, `cameraOn`, `mode`, or `lastChatSentAt` change. Cleanup on unmount.

## 5. Pre-flight tweak

`/instant` already disables "Drop in" until a device is detected. Two additions:
- Acquire **both** audio and video in pre-flight when both devices exist, so the room page doesn't need a second permission prompt regardless of which mode the user picks. Stop the tracks immediately after.
- Pass `mode=video` automatically when only camera exists (already handled), `mode=voice` otherwise.

## 6. Small audit cleanups

- `Around` list filters out the current user (it currently includes self alongside the "you" row in the speaker list).
- `MediaPanel` header chip should read `voiceCount/cap` of *live* participants (`voice + video`), which it already does — keep.
- Remove the `count` (lurker total) from any user-visible label; it can confuse — only show live count.
- `useMediaRoom` cleanup on `roomId` change must also reset `peers` and `error` — current effect calls `leave()` but state from a previous room can briefly flash.
- The "presence" delete subscription in `ChannelView` relies on Postgres `DELETE` events with a row filter; confirm RLS allows the realtime publication to see deletes. If not, fall back to a periodic refetch every 30s.

## Out of scope
- SFU upgrade (mesh stays at 5 cap).
- Screen share, raise hand, reactions.
- Persisting "preferred mode" between sessions.

## Files touched
- `src/hooks/use-media-room.tsx` — channel rename, double-subscribe guard, `setCameraEnabled`, expose `cameraOn`.
- `src/components/media-panel.tsx` — strip pre-join + mode chooser, add Exit + Camera toggle.
- `src/components/channel-view.tsx` — accept `initialMode`, auto-join, inactivity guard + warning dialog, exclude self from Around.
- `src/routes/instant.$id.tsx` — pass `initialMode` from search param.
- `src/routes/instant.index.tsx` — request audio+video together in pre-flight when both devices exist.

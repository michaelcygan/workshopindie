## Goal

Lounge audio should be host-less and frictionless: if a user is participating with audio and the stage has room, they take a seat automatically. If the stage is full, they enter a sequential waitlist and are auto-promoted to speaker the moment a seat opens — no "Request mic" tap, no "Take the mic" acceptance.

## Current behavior (verified)

- `request_lounge_audio_slot` fast-paths to `offered` (not `speaker`); the user still has to click "Take the mic" within 20s.
- `promote_next_lounge_listener` also promotes to `offered`, expecting an accept step.
- `useStreamLoungeAudio` never auto-calls `requestMic` on connect, so an audio-mode participant sits as `listener` with a manual "Request mic" button — matching the screenshot.

## Changes

### 1. Database migration (host-less queue)

New migration that redefines the two RPCs to skip the `offered` step:

- `request_lounge_audio_slot(_room_id)` — if `speaker` count < 10, set caller directly to `speaker` (stamp `audio_joined_at`, clear expiry). Else set to `waiting`, stamp `audio_requested_at`, return queue position.
- `promote_next_lounge_listener(_room_id)` — pick the earliest `waiting` row and set it directly to `speaker`. Drop the expired-offer sweep.
- `accept_lounge_audio_offer(_room_id)` — keep the function signature so old clients don't 404, but make it a thin wrapper that treats any current row as either already-speaker (no-op) or promotes waiting → speaker if under cap.
- Preserve existing GRANTs.

### 2. Client: auto-claim on join

`src/hooks/use-stream-lounge-audio.ts`:

- When `opts.participation === "audio"` and `connected` becomes true and `myState === "chat"` (or `listener`), auto-invoke `requestMic()` once per connection. Guard with a ref so we don't re-request on every presence tick.
- Since the DB now flips straight to `speaker`, the existing publish effect (`myState === "speaker"` → `grantLoungeSpeaker` + `call.microphone.enable()`) handles the rest. If `waiting`, we wait; the realtime subscription will observe the promotion and the publish effect fires automatically.
- `stateToRole` collapses `offered` → `waiting` (defensive — no offers should exist post-migration).
- `acceptMicOffer` stays exported (contract) but is now a no-op alias for `requestMic`.

### 3. Client: strip manual mic UI

`src/components/media-panel.tsx` `LoungeAudioStrip`:

- Remove the `listener` "Request mic" / "Stage full" button. Replace with a passive status pill:
  - `connecting` → "Connecting…"
  - `listener` + audio participation → "Joining stage…" (transient; auto-request in flight)
  - `waiting` → "Waiting · #N" with a "Leave queue" secondary (unchanged)
  - `speaker` → Mute/Unmute (unchanged)
- Remove the `offered` / "Take the mic" branch.
- Sidebar "Request mic" chip (screenshot) uses the same strip, so it disappears there too. Replace with the same status pill.

### 4. Verify

- Solo join with mic permission → land as `speaker`, unmuted, halo visible.
- Fill stage to 10, join as 11th → land as `Waiting · #1`; when a speaker leaves, auto-promoted with no click.
- Deny mic permission → `mic_denied` error surfaces via existing `error` path; DB row released.

### Technical notes

- No changes to `stream-video.functions.ts` (`grantLoungeSpeaker` / `revokeLoungeSpeaker` still gate Stream `send-audio`).
- The `audio_state` CHECK constraint keeps `offered` as a legal value for backward compatibility, but no new writes will produce it.
- Quota / autoplay / moderator paths untouched.


# Stream Video & Audio for Workshop Lounges

Replace the custom WebRTC mesh with Stream's SFU behind a provider flag, add a
speaker-queue backed by Supabase, and lift Lounge capacity to 20 (10 mic seats).
Chat, presence, panels, moderation, discovery, Works/Collabs/Links/Posts,
reactions and visual design are untouched.

## 1. Dependencies & config

- Add `@stream-io/video-react-sdk` (client) and `@stream-io/node-sdk` (server).
- Env:
  - `VITE_STREAM_API_KEY`, `VITE_LOUNGE_AUDIO_PROVIDER` (`stream` | `mesh`).
  - Server-only: `STREAM_API_SECRET`, `STREAM_LOUNGE_CALL_TYPE`
    (default `workshop_lounge`). Read via `process.env` inside handlers only.
- Add `secrets--add_secret` for `STREAM_API_SECRET` (user-supplied), then
  `secrets--set_secret` for `VITE_STREAM_API_KEY`,
  `STREAM_LOUNGE_CALL_TYPE`, `VITE_LOUNGE_AUDIO_PROVIDER=stream` once the
  user supplies the publishable API key.

## 2. New files

- `src/lib/lounge-audio-types.ts` — Workshop-owned adapter surface: `Role`
  (`connecting|listener|waiting|offered|speaker`), `LoungeParticipant`,
  `LoungeAudioApi` (fields listed below), analytics event names.
- `src/lib/stream-video.server.ts` — server-only. Instantiates `StreamClient`
  from `@stream-io/node-sdk` inside its exported helpers; issues user tokens,
  upserts users, grants/revokes `send-audio` capability on the call.
- `src/lib/stream-video.functions.ts` — `createServerFn` wrappers, all
  `.middleware([requireSupabaseAuth])`:
  - `getLoungeStreamToken({roomId})` — verifies room active + caller has
    `instant_presence` row, loads profile, upserts Stream user with
    Supabase UUID, ensures call `workshop_lounge:<roomId>` exists, mints
    short-lived token. Returns `{ apiKey, token, callType, callId, user }`.
  - `grantLoungeSpeaker({roomId})` — called by queue RPC path after
    `accept_lounge_audio_offer` succeeds; grants `send-audio` on the call
    for caller.
  - `revokeLoungeSpeaker({roomId, userId?})` — revokes `send-audio` (self,
    or admin/mod for another user); safe to call on release/leave.
- `src/components/stream-lounge-provider.tsx` — mounts `<StreamVideo>` +
  `<StreamCall>` when provider=stream. Fetches token via server fn, joins as
  listener (`camera: 'disabled'`, `microphone: 'disabled'`), teardown with
  `call.leave()` + `client.disconnectUser()` on unmount/route change.
- `src/hooks/use-stream-lounge-audio.ts` — reads Stream state
  (`useCallStateHooks`: participants, dominantSpeaker, audio publish state,
  connection quality, autoplay state) and Supabase queue state; exposes
  `LoungeAudioApi`.
- `src/hooks/use-mesh-lounge-audio.ts` — thin wrapper adapting the existing
  `use-media-room` hook to the same `LoungeAudioApi` shape (rollback path).
- `src/hooks/use-lounge-audio.ts` — trivial re-export selected by provider
  flag at module top (still a single hook call at the boundary).

## 3. Provider boundary (no conditional hooks)

`lounge.$id.tsx` renders one of two components chosen by `VITE_LOUNGE_AUDIO_PROVIDER`:

```
<LoungeStreamContainer/>   // mounts StreamLoungeProvider -> uses use-stream-lounge-audio
<LoungeMeshContainer/>     // legacy path -> use-mesh-lounge-audio
```

The rest of the Lounge UI consumes `LoungeAudioApi` only, so no Stream types
leak beyond the two hooks + provider.

## 4. `LoungeAudioApi` surface

Fields: `connected`, `role`, `muted`, `busy`, `error`, `speakerCount`,
`queuePosition`, `participants` (Workshop shape: id, name, avatar, isSpeaking,
role, connectionQuality), plus: `requestMic()`, `acceptMicOffer()`,
`leaveQueue()`, `toggleMute()`, `leaveMic()`, `disconnect()`,
`autoplayBlocked`, `resumeAudio()`.

Speaking, dominant speaker, connection quality, and audio-publish state come
from Stream in Stream mode. The custom AudioContext RMS detector in
`use-media-room` is retained only for mesh mode.

## 5. Capacity, presence, queue (database)

Single migration:

- `ALTER TABLE public.instant_presence ADD COLUMN audio_state text NOT NULL
  DEFAULT 'listener' CHECK (audio_state IN
  ('listener','waiting','offered','speaker'))`, plus
  `audio_requested_at timestamptz`, `audio_offer_expires_at timestamptz`,
  `audio_joined_at timestamptz`. Partial index on
  `(room_id, audio_state, audio_requested_at)`.
- Update `claim_lounge_slot` / `join_lounge` cap check to 20; new
  `instant_rooms` default `participant_cap = 20`. Backfill existing rows to
  20 where currently 10.
- New `SECURITY DEFINER` RPCs (all take `_room_id uuid`):
  - `request_lounge_audio_slot` — inside a serializable transaction, lock
    presence rows for the room; if fewer than 10 rows with
    `audio_state='speaker'`, mark caller `offered` with a 20-second
    `audio_offer_expires_at`; else `waiting` with `audio_requested_at=now()`.
    Returns `{state, queuePosition, speakerCount}`.
  - `accept_lounge_audio_offer` — only if caller is `offered` and offer not
    expired and speaker count still < 10, set `speaker` + `audio_joined_at`.
  - `leave_lounge_audio_queue` — resets caller to `listener`, clears
    timestamps.
  - `release_lounge_audio_slot` — sets caller to `listener`, then calls
    `promote_next_lounge_listener`.
  - `promote_next_lounge_listener` — if speaker count < 10, promote the
    oldest `waiting` row to `offered` (20s expiry).
- All RPCs enforce the 10-speaker cap in SQL; client cannot exceed it. Grant
  EXECUTE to `authenticated`.
- A short cron sweep (added to existing sweeper) demotes expired `offered`
  rows back to `waiting`/`listener` and re-promotes.

## 6. Server-side Stream permission sync

`accept_lounge_audio_offer` returns success → client immediately calls
`grantLoungeSpeaker` server fn, which uses the node SDK to grant
`send-audio`. `leaveMic`/`release_lounge_audio_slot` → `revokeLoungeSpeaker`.
Also revoke on mic-permission failure (see §7) so the browser cannot publish.

## 7. Client flow

Entry:
1. Route mounts `StreamLoungeProvider` → fetch token → join call
   `microphone:'disabled', camera:'disabled'`.
2. If `useCallStateHooks().useCallCallingState()` reports autoplay blocked,
   render compact "Tap to hear the Lounge" button that calls
   `call.resumeAudio()` (via Stream autoplay API).
3. No `getUserMedia` on entry.

Mic request path:
1. `requestMic()` → `request_lounge_audio_slot`.
2. If `offered`, UI shows "Your mic is ready · Join speakers / Not now".
   `acceptMicOffer()` → `accept_lounge_audio_offer` → `grantLoungeSpeaker`
   → `call.microphone.enable()` (this is where browser prompts).
3. On `enable()` rejection: `revokeLoungeSpeaker` +
   `release_lounge_audio_slot` + `promote_next_lounge_listener` +
   `role='listener'` + surface toast. Connection stays.
4. `toggleMute()` → `call.microphone.enable()/disable()` (Stream only).
5. `leaveMic()` → disable mic → revoke + release. Presence + Stream call
   membership preserved.

## 8. UI wording & counters (unchanged design language)

- Bottom strip / here-now:
  - Listener: `Listening` · button `Request mic`.
  - Waiting: `Listening · #N waiting` · button `Leave queue`.
  - Offered: `Your mic is ready` · buttons `Join speakers`, `Not now`.
  - Speaker: buttons `Mute` / `Unmute`, `Leave mic`.
- Header count: `17/20 here · 8/10 mic seats`; append `· 3 waiting` when mic
  seats full. `here` uses Supabase `instant_presence` count, not
  `media.count`. All prior `media.count` usages for room-alone / auto-end /
  last-person get repointed to the presence count (single helper in
  `use-lounge-audio`).
- Participant sort in the "Here now" list & speaker rail:
  dominant speaker → other speakers → waiting → listeners.

## 9. Screen share

- Add `LOUNGE_SCREEN_SHARE_ENABLED = false` in `lounge-constants.ts`.
- Hide/short-circuit the screen-share button, status banner, spotlight
  layout tab and stage stream in `media-panel.tsx` when the flag is off (dead
  code paths preserved for the mesh rollback).
- Do NOT drop `lounge_screen_leases` table or mesh code this pass.

## 10. Analytics + telemetry cleanup

- New `emitLoungeAudioEvent(name, payload)` writes to existing analytics
  pipeline. Names: `stream_listener_join_ok/fail`, `audio_reconnect`,
  `mic_request`, `mic_offer`, `mic_permission_denied`, `speaker_join`,
  `speaker_leave`, `queue_abandon`, `connected_minutes` (sampled).
- When provider=stream: skip `turn.functions` grant calls and skip the
  mesh-specific `webrtc_connection_events` writer.

## 11. Browser compatibility

Feature-detect `RTCPeerConnection`, `WebRTC unified plan`, `AudioContext`,
`getUserMedia`. On unsupported browsers render the Lounge chat + panels as
usual but replace the audio strip with "Live audio needs a newer browser."
No provider hook is mounted in that case.

## 12. Manual test matrix (before ship)

Desktop Chrome/Safari/Firefox, iOS Safari, Android Chrome; Wi-Fi↔cellular;
background/foreground; Bluetooth headset swap; mic-denied path; 20-in-room /
10-mic / 11th-request / promotion; leave-mic-stay-in-chat;
disconnect-holding-mic; disconnect-while-waiting; room close + route change.

## Technical details

- Stream call ID = `instant_rooms.id` (UUID); call type
  `workshop_lounge` created once via node SDK on first token mint (idempotent).
- Token TTL 60 minutes; refresh via server fn on Stream `token_expired`
  callback.
- Server functions live in `src/lib/*.functions.ts` (client-safe path).
  `stream-video.server.ts` is imported dynamically inside handlers only.
- All new public tables/columns get GRANTs; new RPCs get EXECUTE grants and
  `SECURITY DEFINER` with locked `search_path = public`.
- Only ambiguous call I want to confirm before coding: whether to keep the
  screen-share button visible-but-disabled with an "off in v1" tooltip, or
  hide it entirely. Default in the plan above is hide.

## Not in scope this pass

- Deleting `lounge_screen_leases` table, mesh code, or `turn.functions`.
- Recording, transcription, or video tracks.
- Admin moderation controls beyond existing role-based UI.

# Audio-First Lounge Refactor (10 seats, chat + optional audio + one screen share)

Refactor the existing Lounge in place. No parallel v2 files, no new npm packages, no SFU. The core mental model shift: **room membership ≠ audio membership**. `instant_presence` remains the 10-seat authority; the WebRTC mesh represents only opted-in audio participants.

## 1. Shared constant + copy

- Add `src/lib/lounge-constants.ts` exporting `LOUNGE_CAP = 10` and `LoungeParticipation = "chat" | "audio"`.
- Global sweep to replace hardcoded `5`, `/5`, `VIDEO_CAP`, `mode="video"|"voice"`, "Voice or video", "Mic or camera", etc. with the new copy vocabulary ("Audio and chat", "Join audio", "Listening", "10 seats", "Share screen", "Someone else is sharing"). Route search schemas accept `mode: "chat" | "audio"` and coerce legacy `voice|video → audio`.

## 2. Database migration (`audio_first_lounge_10_cap.sql`)

- Update `instant_rooms.participant_cap` default to 10; bump active rooms currently at 5 to 10.
- Rewrite `claim_lounge_slot` / `join_lounge` / matchmaker RPCs to read `participant_cap` from the row (no hardcoded 5/10), keep atomic admission, preserve blocks/visibility/status rules, and continue to reject the 11th claimant with `full`.
- Add columns: `screen_sharer_user_id uuid null`, `screen_share_claimed_at timestamptz null`.
- New RPCs (SECURITY DEFINER, RLS-safe): `claim_lounge_screen_share`, `refresh_lounge_screen_share`, `release_lounge_screen_share`. Atomic with a stale-lease timeout (~30s since last refresh). Owner can reclaim; others get `busy`.
- Regenerate Supabase types after approval.

## 3. `useMediaRoom` refactor (audio + screen only)

Preserve all mature connection work (perfect negotiation, session/generation guards, ICE buffering + bounded restarts, visibility/online recovery, telemetry, speaking detection, TURN fallback, cleanup). Remove every camera concept (`MediaMode`, `VIDEO_CAP`, `videoCount`, camera constraints/senders/state/bitrate profiles, video-derived layout).

New public interface (audio-specific, no ambiguous `joined`):

```
audioJoined, muted, speaking, audioCount, peers[]
localAudioStream, busy, error
joinAudio(), leaveAudio(), toggleMute()
screenStream, screenSharerId, isScreenSharing
startScreenShare(), stopScreenShare()
bandwidthReduced
```

- `joinAudio()` requests mic only after explicit user action, uses `{echoCancellation, noiseSuppression, autoGainControl, channelCount:1}`, joins media-presence channel, publishes audio track, starts muted, only peers with other audio-joined users, returns bool. Mic failure never bounces from the room.
- `leaveAudio()` stops mic track, closes media PCs, leaves media channel, stops speaking detector, stops local screen share, keeps `instant_presence` + chat intact.
- Add explicit `muted` field to media-presence broadcast so remote UI distinguishes chat-only / listening / unmuted / speaking (no inference from silence).
- Per-peer split: `{ audioStream, screenStream }`. In `ontrack`, classify by `track.kind` — audio updates `audioStream`, video is treated as screen only and updates `screenStream`. Screen stream never overwrites audio. Screen-track ending clears only `screenStream`.
- Chat-only users never call `getUserMedia`, never join media-presence, never create `RTCPeerConnection`, never touch TURN.

## 4. Screen-share lease integration

`startScreenShare` flow: claim lease → `getDisplayMedia({ video: { width:1280, height:720, contentHint }, audio:false })` → publish track → start refresh interval. Release on: stop, `track.onended`, `leaveAudio`, room exit, unmount, cancelled/failed picker, navigation. Realtime broadcast for instant UI, DB lease authoritative. Non-holder sees "Someone else is sharing the room screen." Chat-only user gets a prompt to join audio first.

## 5. `mesh-bitrate.ts` retune

Remove camera bitrate/FPS/resolution. Budgets keyed on **audio-connected count**, not seat count:
- Opus per sender ~24–32 kbps.
- Screen sender ladder as spec'd (2p→1600/12, 3–4p→800/10, 5–6p→450/8, 7–8p→300/6, 9–10p→220/5), max 1280×720, keep `contentHint`.
- Health ladder always prioritizes audio; degrade/suspend screen before ever touching audio.

## 6. `lounge.index.tsx` lobby

Remove camera detection/toggle/state/permission, `Video`/`VideoOff` controls, "mic or camera" gating, voice-or-video copy. Mic detection is advisory only. "Drop in" and host always work when authenticated. Single preference: "Join audio when I enter" stored at `workshop:lounge-audio-on-entry` (default off for first-timers, remembered afterward). Update `/lounge` head meta description. Rejoin/Hop/active-room cards/direct links pass `mode: "chat" | "audio"` derived from preference.

## 7. `channel-view.tsx` + `lounge.$id.tsx`

Always init: seat, `instant_presence`, chat, reactions, Work, Collabs, Links, room metadata. Only call `media.joinAudio()` when normalized initial `mode === "audio"`. Media errors → toast, stay in room, participation stays `"chat"`. Preserve single `useMediaRoom(roomId)` instance and existing hook-order discipline (no early returns before hooks). Header shows `Live · N/10`. Remove auto-media-mode setter and any redirect-on-media-failure paths. Legacy `mode=video` URL never reactivates camera.

## 8. `media-panel.tsx` — audio identity room

Delete participant camera tiles entirely. Default surface: responsive identity grid (mobile 2col / sm 3col / desktop 5col) up to 10 tiles showing avatar, name, username, speaking ring, "You", chat-only badge, listening/muted state, active-speaker state, existing profile/work peek. When a screen share is active: screen is central stage (`object-contain`, 100dvh + safe-area in fullscreen, no crop for slides/code/art), identity tiles collapse to a compact strip. Dock: Join audio / Mute-Unmute, Hop, panels, Exit. Screen share stays in the More menu. Preserve mobile fullscreen shell + Chat/Work/Collabs/Links sheets — simplify their media assumptions rather than rewriting.

## 9. Preserve everything else

Chat, mentions, reactions, pinned messages/works, Work screening (creative embed video is **not** removed), gallery, Collabs, Links, New Collab, room naming/ending, Hop, waiting-for-others, peeks, mobile sheets, archiving, TURN, blocks, visibility, matchmaker exclusions. Inactivity cleanup: base on meaningful activity or stale presence only — never on "muted" or "no camera" (cameras no longer exist; muted listening is normal). Chat-only counts as active.

## 10. Files touched

Refactor in place: `src/routes/lounge.index.tsx`, `src/routes/lounge.$id.tsx`, `src/components/channel-view.tsx`, `src/components/media-panel.tsx`, `src/hooks/use-media-room.tsx`, `src/lib/mesh-bitrate.ts`, `src/lib/instant.functions.ts`, `src/components/hop-button.tsx`, `src/components/live-topics-list.tsx`, `src/components/live-workshops-rail.tsx`, plus any copy-site or matchmaker helpers surfaced by the sweep.

Add: `src/lib/lounge-constants.ts`, one Supabase migration.

Regenerate: `src/integrations/supabase/types.ts` after migration approval.

No `use-audio-room-v2`, no `media-panel-new`, no `lounge-new`.

## 11. Verification

- Global rg sweep for `VIDEO_CAP`, `mode="video"|"voice"`, `/5`, `5 seats`, `camera`, `getUserMedia.*video`, `Voice or video` → 0 hits in Lounge paths after refactor.
- `npm run lint` and `npm run build` clean.
- Manual matrix: 320/375/390/430/768/1024/1280 px; rooms of 10 chat-only, 5+5, 10 audio, 10 audio + 1 screen share; mic-denied entry stays in room; 11th claimant sees full; simultaneous screen claim → one wins; cancelled picker releases lease; TURN fallback intact; Hop preserves chat/audio pref; no duplicate subscriptions or leaked tracks after navigation.

## Execution order

1. Constant + migration (single call).
2. Types regen.
3. `use-media-room` + `mesh-bitrate` refactor.
4. `channel-view` + `media-panel` refactor.
5. `lounge.index` + `lounge.$id` + `hop-button` + rails + `instant.functions`.
6. Copy sweep + meta.
7. Lint/build + manual matrix.

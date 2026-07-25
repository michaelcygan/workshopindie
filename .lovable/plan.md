## Wave 2 — Audio-first media hook + identity-grid UI

Refactor the WebRTC hook and room UI so Lounge is genuinely audio-first: chat-only participants create no peer connections, cameras are gone, and remote audio vs. screen-share tracks are cleanly separated. Screen-share lease (Phase 5) stays out of this wave — added next.

### Scope

**1. `src/hooks/use-media-room.tsx` — rewrite public interface, keep proven WebRTC internals**

Preserve: direct-first negotiation, STUN/TURN fallback, perfect negotiation, session/generation guards, ICE buffering + bounded restarts, visibility/online recovery, telemetry, speaking detection, cleanup.

Remove: `MediaMode`, `VIDEO_CAP`, `videoCount`, camera constraints/state/toggles, camera senders, camera bitrate profiles, per-participant video modes.

New public shape (semantics — names finalized in-code):

```ts
type AudioPeer = { userId; speaking; muted; audioStream; screenStream };
type MediaRoomState = {
  audioJoined; muted; speaking; audioCount; peers;
  localAudioStream; busy; error;
  joinAudio(); leaveAudio(); toggleMute();
  screenStream; screenSharerId; isScreenSharing;
  startScreenShare(); stopScreenShare();
  bandwidthReduced;
};
```

Behavior rules:
- `joinAudio()` requests mic only after explicit user action; publishes one audio track (`{ echoCancellation, noiseSuppression, autoGainControl, channelCount: 1 }`); starts **muted**; opens peer connections only with other audio-joined participants.
- Mic failure → return `false`, keep user in room (chat-only). Never navigate away.
- `leaveAudio()` stops mic, closes media PCs, leaves media-presence channel, stops speaking detection, releases screen share, keeps `instant_presence` intact.
- Add explicit `muted` field to media-presence broadcast so remotes distinguish chat-only / listening-muted / speaking-capable / speaking. Do not infer muted from silence.
- Separate `audioStream` and `screenStream` per peer. Classify in `pc.ontrack` by `track.kind` — audio → audioStream, video → screenStream (participant cameras no longer exist in Lounge). Screen track ending clears only `screenStream`; audio is never disturbed by screen start/stop.
- Play each remote audio through exactly one dedicated audio element; screen `<video>` is muted.

**2. `src/components/channel-view.tsx` — split room presence from audio**

- Always initialize slot claim, `instant_presence`, chat, reactions, Work, Collabs, Links, room metadata.
- Only call `media.joinAudio()` when normalized entry mode is `"audio"` (read from `useSearch().mode`, honoring the new `workshop:lounge-audio-on-entry` preference for subsequent entries).
- Remove auto-mode-setter and the "media failure → navigate to /lounge" bailout. Media errors surface as a toast; user stays put in chat-only.
- Single `useMediaRoom(roomId)` instance — no second mount for mobile / fullscreen / panels.
- Preserve unconditional hooks order (no early returns before hooks).
- Update inactivity rule: muted + not speaking is normal; only kick on real stale presence (no chat, no explicit activity, no audio heartbeat for the existing timeout).

**3. `src/components/media-panel.tsx` — identity grid replaces video tiles**

- Replace Lounge participant video tiles with a responsive identity grid (mobile 2 cols · sm 3 · desktop 5) sized for 10 tiles.
- Each tile: avatar, display name, username where useful, speaking ring, "You" marker, chat-only badge, listening/muted state, active-speaker highlight. Existing ProfilePeek / WorkPeek hooks intact.
- Screen share present → screen becomes the central stage (`object-contain`, `100dvh` + safe-area on mobile fullscreen); identity tiles collapse into a compact strip that still shows the active speaker.
- Preserve embedded Work screening (that's a creative artifact, not participant camera).

**4. Controls dock — participation, not camera**

Three states with clear primary actions:

| State                      | Label            | Primary action | Secondary            |
|----------------------------|------------------|----------------|----------------------|
| Chat only                  | You're here through chat | Join audio     | —                    |
| Audio connected, muted     | Listening        | Unmute         | Leave audio (overflow) |
| Audio connected, unmuted   | (speaking feedback) | Mute        | Leave audio (overflow) |

- Dock keeps: Join/Mute/Unmute, Next Lounge / Hop, room panels, Exit.
- Screen Share stays in the "More" menu.
- Remove: camera on/off, camera icons/labels, video-focus, participant-video PiP, camera capacity readouts, camera permission surfaces.

**5. `lounge.$id.tsx` bridge cleanup**

- Restore reading `mode` from search and pass it (as `"chat" | "audio"`) into the new `ChannelView` prop `initialParticipation`.
- Delete the temporary hardcoded `"voice"` bridge introduced in Wave 1.
- `HopButton` prop updated to `mode: "chat" | "audio"`; internal navigation preserves preference.

**6. Copy sweep (Lounge surfaces only)**

Replace: "Voice or video", "Mic or camera", "Camera unavailable", "Camera on/off", "Focus video" → "Audio and chat", "Join audio", "Chat only", "Listening", "Mute/Unmute", "Leave audio", "Share screen".

### Out of scope this wave

- DB-backed screen-share lease + RPCs — Wave 3 (Phase 5).
- Push-to-talk.
- SFU / new media dependencies.
- Non-Lounge video surfaces (Work screenings, YouTube/Vimeo embeds, published-work video) — untouched.

### Files touched

- `src/hooks/use-media-room.tsx` (rewrite)
- `src/components/channel-view.tsx` (participation split, remove auto-join and bailout)
- `src/components/media-panel.tsx` (identity grid + screen-share stage)
- `src/components/hop-button.tsx` (mode type)
- `src/routes/lounge.$id.tsx` (restore mode passthrough, drop bridge)
- Copy touch-ups in `channel-view.tsx` / `media-panel.tsx` / `hop-button.tsx` as needed

### Acceptance (Wave 2 subset)

- Chat-only user with denied/absent mic can enter, chat, see peers, and creates no `RTCPeerConnection`.
- `Join audio` from inside the room adds mic mid-session without duplicating tracks; leaving audio keeps user + chat.
- Peer with `audioStream` + `screenStream` renders both without cross-clobber; ending screen share doesn't cut audio.
- Single `useMediaRoom` instance per room; no hook-order regressions; Hop preserves chat/audio choice.
- Lounge UI shows no camera controls anywhere; header still reads `Live · N/10`.

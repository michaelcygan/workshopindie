# Lounge — Audio + Chat Only Cleanup

Convert Lounge to a strictly chat + optional audio product. Remove all camera, screen-share, video-PiP, and legacy mesh infrastructure. Preserve chat, Stream audio, speaker queue, Work screening, Player, Drive, Collabs, Links, Gallery, and fullscreen surfaces.

Delivered in 7 sequential waves. After each wave: build, typecheck, grep for stragglers, spot-check Lounge.

---

## Wave 1 — Visible screen-share + video UI removal

**`src/components/channel-view.tsx`**
- Delete desktop Screen Share button, tooltip, disabled/loading/error states, `MonitorPlay`/`MonitorOff` imports, all `media.startScreenShare` / `stopScreenShare` calls, and screen-share-driven layout branches.
- Rename `videoFocus` → `contentFocus` (or `sidebarHidden`). Relabel "Focus video" → "Focus room", "Show chat" stays, add "Hide sidebar" / "Show sidebar".
- Keep fullscreen button, `fsView`, fullscreen Chat/Gallery/Work, minimize.

**`src/components/media-panel.tsx`**
- Remove Screen Share pill, source detection, local/remote screen stream detection, `SpotlightVideo`, screen-share spotlight rendering, `showLocalVideo`, camera state, mobile More menu when Screen-Share-only, screen-share-driven Stage mode.
- Rename `VideoStage` → `AudioStage`, `FullscreenRoom` → `FullscreenLounge`. Update comments/vars.
- Audio stage renders: local speaker avatar (when on audio), remote speakers, speaking indicators, muted indicator, speaker count, empty state.
- Chat-only listeners appear in the participants list, not on the audio stage.

**Fullscreen layout vocabulary**
- Allowed labels: Speakers, Work, Tool, Screening. Remove Video/Cam/Director/Screen labels. When nothing is being presented, prioritize Chat + speakers, not an empty black stage.

## Wave 2 — Lounge tools cleanup

**`src/components/workshop-tools-panel.tsx`**
- Active Lounge tools: Drive, Player only.
- Remove Screen Share and Pop-out from `ShippedToolType`, `TOOL_REALTIME`, `TOOL_ORDER`, `STAGE_TOOL_OPTIONS`, picker, Add Tool menu, category defaults, `ActiveToolBody`, empty states, icons/imports.
- Drop `MediaForTools` fields: `cameraOn`, `setCameraEnabled`, `isScreenSharing`, `screenSharerId`, `startScreenShare`, `stopScreenShare`. Remove `MediaForTools` entirely if Drive/Player don't need it.

**Delete `src/components/workshop-screen-share-panel.tsx`.**

**Legacy rows** — `screen_share` / `pip` / `recorder` tool rows render a small retirement notice instead of mounting anything. Copy:
- Screen Share → "Screen Share is no longer available in Lounge. Use Drive, Player, or publish a Work to share creative material."
- Recording → "The Recording tool was retired. Share a recording or external session link through Drive."

## Wave 3 — Remove video-oriented PiP

- Delete `src/components/workshop-pip.tsx` and `useWorkshopPip`.
- Remove Pop-out tool, toolbar button, `PopOutButton`, PiP portal from `ChannelView`, camera/screen source selection, Director/Cam/Split modes. Delete `src/types/document-pip.d.ts` if unused elsewhere.

## Wave 4 — ChannelView migrates fully to `LoungeAudioApi`

- Remove `useMediaRoom(roomId, { camera: false })` from `channel-view.tsx`.
- Route all audio state (connected, role, muted, busy, speakerCount, queuePosition, participants, requestMic, acceptMicOffer, leaveQueue, toggleMute, leaveMic, disconnect, reconnecting, error) through `useLoungeAudio()`.
- Extend `LoungeAudioApi` only if genuinely needed (e.g. `isSelfSpeaking`, `participantById`) — never camera/screen/video/track fields. Wire additions in both `use-stream-lounge-audio` and `use-mesh-lounge-audio` for parity until Wave 5.
- Chat-only entry must not call `getUserMedia`, request mic, or create a second transport. Audio starts only on explicit audio actions.
- Stream failure → user stays in Chat with a retry/error state. No silent mesh fallback (already scheduled for removal).

## Wave 5 — Retire legacy Lounge mesh

Verify with `rg` whether `useMediaRoom` is imported by any non-Lounge feature.

**If Lounge-only (expected):**
- Delete `src/hooks/use-mesh-lounge-audio.ts`, `src/hooks/use-media-room.tsx`, `src/lib/mesh-bitrate.ts` (if Lounge-only), Lounge-only TURN telemetry.
- Remove `LOUNGE_AUDIO_PROVIDER` / `VITE_LOUNGE_AUDIO_PROVIDER`, mesh branch in `stream-lounge-provider.tsx`. Stream becomes the sole provider; on failure, render a chat-only fallback (not `MeshProvider`).

**If used elsewhere:** strip Lounge imports/usage, remove screen-share + camera behavior from the shared surface, rename to reflect its remaining scope.

## Wave 6 — Screen-share lease + realtime deletion

- Delete `src/lib/lounge-screen-lease.ts`.
- Remove all `claimLoungeScreenShare` / `refreshLoungeScreenShare` / `releaseLoungeScreenShare` / `LEASE_HEARTBEAT_MS` references.
- Remove realtime subscriptions watching `screen_sharer_user_id` and any `type: "screen"` broadcast events.
- Confirm no Lounge code calls `navigator.mediaDevices.getDisplayMedia()`.

## Wave 7 — Database cleanup + terminology + verification

**Migration (after code stops reading/writing these):**
- Drop `instant_rooms.screen_sharer_user_id`, `instant_rooms.screen_share_claimed_at`.
- Drop RPCs `claim_lounge_screen_share`, `refresh_lounge_screen_share`, `release_lounge_screen_share` + related indexes/grants.
- Idempotent cleanup of `instant_tool_items` rows with `tool_type in ('screen_share','pip')` — only after auditing that these enum values aren't used outside Lounge.
- Regenerate Supabase types.

**Terminology sweep** across Lounge code for: `camera`, `Camera`, `videoFocus`, `VideoStage`, `videoCount`, `videoCap`, `screen share`, `Screen Share`, `screen_share`, `screenSharer`, `screenStream`, `Director`, `Cam`, `Focus video`, `Mute/Camera`. Do NOT touch Work metadata, embeds, or file-type "video".

**Capacity denominators** — use `LOUNGE_CAP` for total and the speaker cap constant for speakers. No hardcoded `/10` where the total room cap differs.

**Final acceptance pass** — build, typecheck, lint; manual matrix per user spec (desktop + mobile + multi-participant).

---

## Technical notes

- `LoungeAudioProvider` currently falls back to `MeshProvider` on Stream token/join failure. After Wave 5 this becomes a chat-only fallback: provider returns a null-audio API where `connected=false`, `role='listener'`-equivalent chat-only, `requestMic` surfaces the audio-unavailable error. UI must handle this gracefully — chat/Work/Links stay fully live.
- `LoungeAudioApi` currently has no `isSelfSpeaking` / `participantById`. Add only when a Wave-4 consumer actually needs them; keep the surface narrow.
- Keep `ScreeningStage` and Work-iframe fullscreen/PiP permissions — that's content playback, not broadcasting.
- Two-deployment rule: Waves 1–6 land first (code stops touching screen-share DB fields), Wave 7 migration runs after that deploys cleanly.
- No new packages.

## Out of scope

- Redesigning any non-Lounge Workshop pages.
- Building a new audio-only mini-player (may be planned separately later).
- Removing "video" from unrelated Work/media/embed code.

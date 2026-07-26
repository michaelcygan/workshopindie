## Lounge Audio-Only Cleanup — Waves 2–7

Wave 1 (visible screen-share UI removal) is done. This plan covers the remaining waves. I'll execute them sequentially, typechecking after each, so you can stop me between waves if anything looks off.

### Wave 2 — Retire Lounge tools tied to video
- `src/components/workshop-tools-panel.tsx`: drop `screen_share` and `pip` from `STAGE_TOOL_OPTIONS` / any tool registry; keep Drive, Player, Whiteboard, Docs, Polls, etc.
- `src/routes/workshops.$slug.tools.$tool.tsx`: remove routes/handlers for `screen_share` and `pip`.
- Delete `src/components/workshop-screen-share-panel.tsx`.
- Grep for stragglers (`screen_share`, `"pip"` tool id) and clean references.

### Wave 3 — Remove PiP infrastructure
- Delete `src/components/workshop-pip.tsx` (exports `useWorkshopPip`, `PopOutButton`).
- Delete `src/types/document-pip.d.ts`.
- Remove PiP button + `pip.portal` render from `channel-view.tsx` and any other consumer.

### Wave 4 — Migrate ChannelView off `useMediaRoom` onto `LoungeAudioApi`
- Wrap `ChannelView` body in `<LoungeAudioProvider>` (already used by the Lounge route; verify no double-wrap).
- Replace `const media = useMediaRoom(...)` with `const audio = useLoungeAudio()` and adapt call sites:
  - `media.joined` → `audio.connected`
  - `media.joinAudio()` → `audio.requestMic()` (only when `initialMode === "audio"`)
  - `media.leave()` → `audio.disconnect()`
  - `media.muted/toggleMute/error/busy` → same names on `LoungeAudioApi`
  - `media.count` → derive from `audio.participants.length`
  - Drop everything camera/screen/peer-stream related.
- Refactor `MediaPanel` prop `m: MediaState` → `audio: LoungeAudioApi`. Delete `VideoStage`, `FullscreenRoom`, `SpotlightVideo`, `AudioTile`-video-fallback branches; keep the speaker-list / chat-dock UI, renamed to `AudioStage` / `FullscreenLounge`. Update imports in `channel-view.tsx`.
- Remove the `pip` state hook, `useVisibleVideo`, and other video-only helpers used only here.

### Wave 5 — Retire the legacy WebRTC mesh transport
- Delete `src/hooks/use-media-room.tsx`, `src/hooks/use-mesh-lounge-audio.ts`, `src/lib/mesh-bitrate.ts`, `src/lib/turn.functions.ts` (if only used by mesh).
- Simplify `src/components/stream-lounge-provider.tsx` to a single Stream implementation: drop `MeshProvider`, `LOUNGE_AUDIO_PROVIDER` branching, and mesh fallback on token error (surface the error to the caller instead).
- In `src/lib/lounge-constants.ts`: remove `LOUNGE_AUDIO_PROVIDER`, `LOUNGE_SCREEN_SHARE_ENABLED`, `isLoungeAudioSupported`'s mesh checks — keep Stream-only capacity constants.
- Delete `src/hooks/use-visible-video.ts` if unused after Wave 4.

### Wave 6 — Remove screen-share lease + broadcast plumbing
- Delete `src/lib/lounge-screen-lease.ts`.
- Grep for `claim_lounge_screen_share`, `refresh_lounge_screen_share`, `release_lounge_screen_share`, `screen_sharer_user_id`, `screen_sharer_started_at` usages in client code and remove.
- Remove any Realtime channels dedicated to screen-share sharer broadcasts.

### Wave 7 — DB cleanup, terminology, verification
- Migration:
  - `DROP FUNCTION public.claim_lounge_screen_share`, `refresh_lounge_screen_share`, `release_lounge_screen_share` (with correct signatures).
  - `ALTER TABLE public.instant_rooms DROP COLUMN screen_sharer_user_id, DROP COLUMN screen_sharer_started_at` (only if no remaining code references — verified after Wave 6).
- Terminology sweep in the Lounge surfaces only: replace stray "video"/"camera"/"screen share" copy with chat/audio equivalents (`ChannelView`, `MediaPanel`, `stream-lounge-provider.tsx`, `lounge-*` files). Leave Workshop live-room video code untouched.
- Final: `bunx tsgo --noEmit`, then a Playwright pass on `/lounge/<id>` to confirm the room loads, chat sends, mic request works, and no console errors reference removed APIs.

### Notes / risks
- I'll re-check each `useMediaRoom` consumer before deleting the hook — if a non-Lounge surface still uses it, I'll narrow the deletion.
- The DB drop in Wave 7 is gated on Wave 6 client cleanup being complete; I'll re-grep before writing the migration.
- No feature flags added; removals are unconditional per your spec.

I'll pause after Wave 4 (biggest structural change) for you to sanity-check before continuing to the mesh + DB deletions.

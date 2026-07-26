## Goal
Finish the Lounge audio-only cleanup by consolidating on Stream everywhere. Workshops is no longer an active surface, so we treat any shared code as Lounge-only and delete the WebRTC mesh + legacy Workshop room plumbing.

## Waves

### Wave 4 — Migrate ChannelView / MediaPanel to `useLoungeAudio`
- Replace `useMediaRoom` calls in `src/components/channel-view.tsx` and `src/components/media-panel.tsx` with `useLoungeAudio()` from the provider.
- Map old fields: `audioJoined` → `connected`, `joinAudio/leaveAudio` → `requestMic/leaveMic`, `toggleMute` unchanged, `peers/speaking/muted` → derived from `participants`.
- Delete any remaining screen-share, spotlight, peer-video, and PiP-adjacent code paths inside these components (dead since Wave 1–3).
- Ensure both Lounge routes (`src/routes/lounge.$id.tsx`) already wrap in `<LoungeAudioProvider>` (they do) so the hook is always available.

### Wave 5 — Retire the Workshop room surface
- Since Workshops is deprecated, redirect `src/routes/workshops.$slug.tsx`, `workshops.index.tsx`, `workshops.new.tsx`, `workshops.$slug.tools.tsx`, `workshops.$slug.tools.$tool.tsx`, `workshops.$slug.archive.tsx` to `/lounge` (or a goodbye notice).
- Remove Workshop nav entries, composer shortcuts, and any homepage/profile rails pointing to Workshops.
- Keep the DB tables for now (data preservation); only the frontend routes are removed.

### Wave 6 — Delete mesh/WebRTC transport
- Delete: `src/hooks/use-media-room.tsx`, `src/hooks/use-mesh-lounge-audio.ts`, `src/lib/mesh-bitrate.ts`, `src/lib/turn.functions.ts`, `src/lib/lounge-screen-lease.ts`, `src/components/workshop-pip.tsx` residues, and `src/components/stream-lounge-provider.tsx`'s `MeshProvider` branch + `LOUNGE_AUDIO_PROVIDER` switch.
- Simplify `LoungeAudioProvider` to always mount `StreamProvider`; on token failure show an inline error state instead of falling back to mesh.
- Remove `LOUNGE_AUDIO_PROVIDER` and mesh-only constants from `src/lib/lounge-constants.ts`.
- Drop `claim/refresh/release_lounge_screen_share` RPC callsites and any `instant_rooms.screen_sharer_user_id` references from the client.

### Wave 7 — Terminology + DB cleanup
- Sweep copy: "Workshop room / mesh / screen share / PiP" → Lounge-audio wording. Skip billing tier "Workshop Plus" naming.
- Migration: drop unused columns/RPCs (`screen_sharer_user_id`, `screen_sharer_last_seen_at`, `claim/refresh/release_lounge_screen_share`), and any mesh-only presence columns if unused. List each drop for approval before running.
- Delete retired tool types (`screen_share`, `pip`) from `LegacyStoredToolType` once no stored rows reference them (verify via read_query first).

## Verification per wave
- `tsgo` after each wave.
- Playwright smoke on `/lounge/$id`: join → speak → mute → leave, confirming no console errors and Stream track state.
- Grep for `useMediaRoom`, `mesh`, `screen_share`, `pip` remains after Wave 6 — expect zero hits outside deleted files.

## Confirmation before I start
Two things worth confirming before Wave 5:
1. Redirect target for `/workshops/*` — `/lounge` or a plain "retired" page?
2. OK to delete the Workshop routes outright (vs. keeping read-only archive pages)?

If you're fine with `/workshops/* → /lounge` and hard deletes, I'll proceed straight through Waves 4→7.
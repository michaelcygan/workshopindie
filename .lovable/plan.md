## What's left in the Lounge cleanup

Wave 5 (retire Workshops) and the top of Wave 6 (Stream-only provider) are done. The mesh transport is still wired underneath because `ChannelView` and `MediaPanel` read from `useMediaRoom` directly. Until that's rewritten, the mesh files can't be deleted.

### Wave 4 — Migrate ChannelView + MediaPanel to `useLoungeAudio()`
- `src/components/channel-view.tsx`: replace the `useMediaRoom(roomId, ...)` call with `useLoungeAudio()`. Map:
  - `media.audioJoined` → `connected`
  - `media.peers` → `participants.filter(p => !p.isSelf)`
  - `media.speaking` / `media.muted` → participant flags / `muted`
  - `media.joinAudio` / `media.leaveAudio` → `requestMic` / `leaveMic`
  - `media.toggleMute` → `toggleMute`
  - `media.busy` / `media.error` → `busy` / `error`
- `src/components/media-panel.tsx`: same swap; already down to audio-only speaker bubbles, so the surface is small.
- `src/components/workshop-recorder.tsx` and `src/components/workshop-tools-panel.tsx`: strip the last mesh imports (recorder is a leftover surface; if it's still linked, migrate; if orphaned, delete).

### Wave 6 — Delete mesh transport code
Once no file imports them:
- `src/hooks/use-media-room.tsx`
- `src/hooks/use-mesh-lounge-audio.ts`
- `src/lib/mesh-bitrate.ts`
- `src/lib/lounge-screen-lease.ts`
- `src/lib/turn.functions.ts`
- `src/components/workshop-screen-share-panel.tsx` (already deleted — verify)
- `src/components/workshop-pip.tsx` (already deleted — verify)

### Wave 7 — Database + server cleanup
- Drop the `claim_lounge_screen_share`, `refresh_lounge_screen_share`, `release_lounge_screen_share` RPCs.
- Drop `instant_rooms.screen_sharer_user_id` and any related columns.
- Drop the `webrtc_connection_events` table (mesh telemetry) if no dashboard still reads it — confirm before dropping.
- Remove the TURN credential grant path (`turn_credential_grants` table + `turn.functions.ts` server fn).

### Verification
- `bunx tsgo --noEmit` shows no new errors on touched files.
- Manual smoke: join a Lounge, verify audio join/leave, mute, speaker halo, chat, and the Links/Posts tabs still work.
- `rg "useMediaRoom|mesh-bitrate|screen_sharer_user_id"` returns zero hits.

### Scope note
Wave 4 is the load-bearing step (~24 `media.*` references in `channel-view.tsx` alone). I'd do it as its own turn so you can review the ChannelView diff before I delete the mesh files and run the DB migration.

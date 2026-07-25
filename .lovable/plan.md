Yes — Wave 4 is the final V1 contract-completion pass for the audio-first Lounge. After Waves 1-3 (10-person cap, chat-only entry, audio facade, and the DB-backed screen lease), the remaining gap is the camera remnants that still appear in the Lounge UI and media hook. The `mesh-bitrate.ts` file already flags this: the camera stubs are kept only for hook compatibility and should be removed in the next wave.

Scope

1. Lobby cleanup (`src/routes/lounge.index.tsx`)
   - Remove the camera toggle from the header.
   - Drop the camera preference from localStorage (`workshop:av-prefs`).
   - Update subtitle/help copy to "audio and chat" only.

2. Room UI cleanup — no camera tiles in the Lounge
   - `src/components/media-panel.tsx`: remove local/remote camera rendering from `VideoStage` and `FullscreenRoom`. Keep only the audio avatar grid and the screen-share spotlight.
   - `src/components/channel-view.tsx`: remove the camera branch from the presence strip, update the idle-warning copy from "turn your camera on" to "unmute", and pass the new audio/chat mode to `HopButton` instead of the legacy `video` mode.

3. Audio-first hook constraint
   - Add an optional `camera: false` constraint to `useMediaRoom` for Lounge contexts. In that mode, `setCameraEnabled` and legacy `video` mode become no-ops. This lets the same hook keep serving Workshop Recorder/PiP outside the Lounge while making the Lounge camera-free.
   - Update `MediaForTools` to not require camera fields.

4. Tools in the Lounge
   - In instant/Lounge rooms, hide the "room camera" source and camera toggle in `WorkshopRecorder` and `WorkshopPip`. Keep microphone and screen-share sources available.

5. Bitrate model cleanup (`src/lib/mesh-bitrate.ts`)
   - Rename `camKbps` to `audioKbps` (it is the audio ceiling, not a camera) and remove the `camFps`/`camMaxHeight` stubs.
   - Update `applyBudget` in `useMediaRoom` to use the new audio-only profile fields.

6. Screen-share edge-case hardening
   - Remove the camera-track restoration path in `stopScreenShare`.
   - Ensure the lease heartbeat is cleared and the video sender is removed cleanly when sharing stops or the lease is lost.

Out of scope

- Push-to-talk (architected for later, not implemented now).
- Any SFU or external media service.
- New npm packages.

Acceptance

- No camera controls or camera tiles visible anywhere in the Lounge flow.
- Screen share is the only video surface and remains governed by the DB lease.
- Chat-only participants still never enter the WebRTC mesh.
- The 10-person audio mesh and the screen-share heartbeat keep working.

If you approve this plan, I'll implement Wave 4 in one pass and verify the Lounge still works in both desktop and mobile view.
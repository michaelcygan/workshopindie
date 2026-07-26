## Goal

Finish the Stream-first Lounge by wiring the provider/hooks and rewiring the Lounge UI to consume the new `LoungeAudioApi`. Part 1 already landed the DB migration (cap 20, speaker queue RPCs), security fixes, adapter types, Stream server + server functions, and installed SDKs.

## What ships in this pass

1. **`src/hooks/use-stream-lounge-audio.ts`** — Stream React SDK implementation of `LoungeAudioApi`.
   - Reads token from `getLoungeStreamToken`; joins the `workshop_lounge` call as listener.
   - Subscribes to Supabase `instant_presence` realtime → maps `audio_state` (`chat` / `queued` / `offered` / `speaker`) onto `role` / `queuePosition` / `speakerCount`.
   - Speaker flow: `request_lounge_audio_slot` RPC → on `offered`, user taps "Take the mic" → `accept_lounge_audio_offer` + `grantLoungeSpeaker` → SDK enables mic + publishes.
   - Detects `autoplayBlocked` and exposes `resumeAudio()`.
   - Cleanup: leaves the call on unmount; calls `release_lounge_audio_slot` if speaker.

2. **`src/hooks/use-mesh-lounge-audio.ts`** — thin adapter that presents the existing `useMediaRoom` mesh hook as the same `LoungeAudioApi` shape (no behavior change; keeps the fallback provider working).

3. **`src/hooks/use-lounge-audio.ts`** — selector that reads `LOUNGE_AUDIO_PROVIDER` and returns the correct implementation. Called only inside `<LoungeAudioProvider>` so hook order is stable.

4. **`src/components/stream-lounge-provider.tsx`** — mounts `<StreamVideo>` + `<StreamCall>` when provider is `stream`; renders children plainly when provider is `mesh`. Exposes a `LoungeAudioContext` so `media-panel.tsx` reads one API regardless of transport.

5. **Rewire `src/components/media-panel.tsx`**:
   - Consume `LoungeAudioApi` via context.
   - Replace "Join audio" strip with role-aware control: **Listening → Request mic → Waiting (#N in queue, Leave queue) → Take the mic → Speaking (Mute/Leave mic)**.
   - `SpeakerBubble` set now driven by `participants` (up to 20 seats; only `role === "speaker"` get the halo). Chat-only participants remain in the "Here now" list.
   - Gate screen-share UI behind `LOUNGE_SCREEN_SHARE_ENABLED` (currently off).
   - Autoplay-blocked banner → `Enable sound`.

6. **Rewire `src/routes/lounge.$id.tsx`**: wrap the room in `<LoungeAudioProvider roomId=... participation=...>`; keep chat-only participants outside the audio join path.

7. **Feature-detect fallback**: when `isLoungeAudioSupported()` is false, show a "This browser can't join Lounge audio — chat still works" strip instead of mounting the provider.

## Out of scope for this pass

- Mesh-provider deletion (kept behind flag for rollback).
- Recorder integration for Stream call audio.
- The unrelated `work_applications_status_bypass` security finding — will surface separately if you want it fixed.
- Wiring `LOUNGE_AUDIO_EVENTS` into the real telemetry sink (still console-tagged).

## Verification

- `tsgo` typecheck passes.
- Manual smoke against preview: open two tabs → both land as listeners → tab A requests mic → gets speaker seat → tab B sees speaker halo + count. Screen share button absent.
- Vite dev-server logs checked for hydration / hook-order warnings.

## Notes

No new migrations, no schema changes, no new secrets — Part 1 covered those.

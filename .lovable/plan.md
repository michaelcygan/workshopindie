# Wave 5 — Lounge Audio: Reliability, Moderation & Rollout

Wave 4 shipped telemetry, hardened the token path, and polished the queue strip. Wave 5 turns the Stream Lounge from "working" into "production-default" by closing the last reliability, moderation, and observability gaps, then flipping the provider flag.

## 1. Reliability & reconnection

- **Auto-rejoin on transport drop.** In `use-stream-lounge-audio.ts`, subscribe to `call.state.callingState$` transitions (`reconnecting` → `offline` → `joined`) and emit `audio_reconnect` telemetry. If a drop exceeds ~15s, surface a "Reconnecting…" pill in `LoungeAudioStrip` with a manual "Rejoin" button that re-invokes `getLoungeStreamToken`.
- **Real autoplay detection.** Replace the conservative heuristic with the SDK's `call.state.hasOngoingScreenShare$`/audio-element gating: watch for the first `play()` rejection on remote audio and set `autoplayBlocked=true`; `resumeAudio()` calls `call.microphone.resume?.()` and manually plays pending elements.
- **Stale-seat sweep.** Add a Postgres function `sweep_stale_lounge_speakers()` that revokes `speaker` audio_state when the matching `instant_presence` row hasn't heartbeat-ed in 60s. Schedule via `pg_cron` every minute (aligns with existing sweep jobs under `api/public/*.sweep.ts`).

## 2. Moderation controls

- **Mute / remove speaker.** New RPC `moderate_lounge_speaker(_room_id, _target_user_id, _action)` where action ∈ (`mute`, `remove`). Callable by room host or platform admin (`has_role(auth.uid(),'admin')`). On `remove`, flip audio_state to `chat` and call `revokeLoungeSendAudio` server-side.
- **UI hook.** Add a kebab on each `SpeakerBubble` (host/admin only) with "Mute" and "Remove from stage". Reuses existing dropdown primitives — no new sheet.
- **Report from stage.** Feed reports through the existing `reports` table with `entity_type='lounge_speaker'` so admin moderation dashboard picks them up automatically.

## 3. Observability

- **Connected-minutes rollup.** Client emits `connected_minutes` every 60s while `connected`. Add a materialized view `lounge_audio_daily` (user_id, day, minutes, mic_grabs, queue_abandons) refreshed nightly for the admin analytics page.
- **Admin panel tile.** Extend `admin.engagement.tsx` with a "Lounge audio" card: yesterday's DAU on audio, avg queue wait, mic-denied rate, reconnect rate.

## 4. Rollout

- Flip default in `src/lib/lounge-constants.ts` so `LOUNGE_AUDIO_PROVIDER` falls back to `"stream"` when the env var is missing; keep `"mesh"` as an explicit opt-out for one release.
- Update `.env.production` to set `VITE_LOUNGE_AUDIO_PROVIDER=stream`.
- Add a short runbook note in `.lovable/plan.md` covering: how to roll back (set env to `mesh`), where telemetry lives, and which RPCs gate the queue.

## Technical notes

- All new RPCs are `security definer`, `search_path = public`, and grant `EXECUTE TO authenticated` only.
- `lounge_audio_daily` mv gets `GRANT SELECT TO service_role` only; the admin page reads it through a `requireSupabaseAuth` server fn that checks `has_role`.
- No changes to `client.ts`, `client.server.ts`, `auth-middleware.ts`, or `types.ts`.
- Reconnection logic stays inside the Stream hook so the mesh provider is untouched (clean rollback).

## Out of scope (defer to Wave 6)

- Recording / transcripts.
- Multi-room simultaneous audio.
- Push-to-talk hotkey.

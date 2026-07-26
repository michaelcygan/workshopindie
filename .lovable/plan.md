## Wave 4 — Harden & observe the Stream Lounge audio path

Two deferred items from Wave 2/3 plus a small polish pass, kept tightly scoped so nothing else in the app shifts.

### 1. Fix `stream_video_token` unauthenticated-access finding

The Stream token-issuing server function currently mirrors the same shape flagged on `work_applications_status_bypass` — callable without a verified session, and shaped so a caller could request a token for any `user_id`/`room_id`.

- Add `.middleware([requireSupabaseAuth])` to the token function so `context.userId` is the source of truth.
- Ignore any client-supplied `user_id`; always mint the token for `context.userId`.
- Validate `room_id` with Zod, then verify the caller is actually a participant of that lounge (row in `instant_presence` for that room, or an active `request_lounge_audio_slot` claim) before issuing.
- Return a typed error (`{ error: 'forbidden' }`) instead of a raw provider error; never leak Stream API error bodies.
- Re-run `security--run_security_scan` after the change and mark the finding resolved if clean.

### 2. Wire `emitLoungeAudioEvent` to a real telemetry sink

Today the emitter is a no-op stub. Wave 4 gives it a durable landing spot without adding a new vendor.

- Add a `lounge_audio_events` table (id, room_id, user_id nullable, event text, payload jsonb, created_at) with RLS: insert allowed for `authenticated` on rows where `user_id = auth.uid()`, select restricted to `service_role` + admins via `has_role`.
- GRANT insert to `authenticated`, all to `service_role`, per public-schema-grants.
- New `logLoungeAudioEvent` server fn (auth-required) that writes one row; `emitLoungeAudioEvent` calls it fire-and-forget with a short in-memory debounce (dedupe identical `event` within 2s per room+user) so noisy `speaking_start/stop` events don't flood the table.
- Instrument the existing call sites already present in the Stream and mesh hooks — no new events invented in this wave.
- Add a lightweight admin read via existing admin dashboard shell (read-only table view, last 200 rows, filter by room) — no new nav entry, reachable from the existing lounge admin section.

### 3. Small polish tied to Wave 3

- Speaker-queue strip: when `api.error` is a known recoverable case (autoplay blocked, mic permission denied), swap the generic error text for a specific hint + a retry button that calls `api.resumeAudio()` / re-requests permission. Unknown errors keep today's copy.
- Roster pill: pluralize correctly (`1 waiting for mic` vs `N waiting for mic`) and hide the pill entirely when the queue is empty (currently renders `0 waiting`).
- Sanity: confirm `LOUNGE_SCREEN_SHARE_ENABLED=false` fully hides the fullscreen share affordance on mobile too (Wave 3 only checked desktop).

### Out of scope for Wave 4

- Full `media-panel.tsx` visual redesign (that's its own wave).
- Any change to mesh transport behavior — mesh stays the default until we flip `VITE_LOUNGE_AUDIO_PROVIDER=stream`.
- New telemetry vendors (PostHog/Segment) — DB sink only for now.

### Verification

- `tsgo` clean.
- Security scan re-run: `stream_video_token` finding gone.
- Manual: request mic in a Stream-provider lounge → row appears in `lounge_audio_events`; deny mic permission → strip shows the specific hint + retry.

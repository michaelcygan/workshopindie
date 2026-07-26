## Wave 3: Lounge audio monthly quota (10 h / UTC month for Free)

Server-authoritative tracking of connected minutes with a hard cap enforced before join, plus the deferred `work_applications` privilege-escalation fix.

### 1. Data model (migration)

Add lightweight monthly rollup, computed from the existing `lounge_audio_events` `connected_minutes` pings (already fired once per minute by `use-stream-lounge-audio.ts`). No new client instrumentation needed.

- SQL function `public.lounge_minutes_this_month(_user_id uuid) returns int`
  - `security definer`, `stable`, `set search_path = public`
  - `SELECT count(*) FROM lounge_audio_events WHERE user_id=_user_id AND event='connected_minutes' AND created_at >= date_trunc('month', now() at time zone 'utc')`
  - Grants: `EXECUTE TO authenticated`.
- SQL function `public.try_reserve_lounge_minute(_user_id uuid, _room_id uuid, _limit int) returns boolean`
  - Advisory-lock key `hashtext('lounge_minute:'||_user_id::text)`.
  - Counts current month minutes; if `_limit IS NULL OR count < _limit`, inserts a `connected_minutes` telemetry row and returns true; else returns false.
  - Grants: `EXECUTE TO authenticated`.
  - Callers: server-side minute-tick path (see §3) — replaces the direct client insert.

### 2. Access resolver

New `src/lib/lounge-access.server.ts`:

- `resolveLoungeAudioAccess(userId)` returns `{ minutesUsed, monthlyLimit, canJoinAudio, remainingMinutes, resetLabel, reason }`.
- Reads the user's subscription with `supabaseAdmin` and calls `resolveEntitlements`; Plus/trial → `monthlyLimit = null`, `canJoinAudio = true`.
- Reads `lounge_minutes_this_month` for Free/lapsed.

### 3. Server enforcement

- New `getLoungeAudioAccess` server fn (`.middleware([requireSupabaseAuth])`) returning the resolver output for the caller.
- New `reserveLoungeMinute({ roomId })` server fn:
  - Calls `try_reserve_lounge_minute` with the user's `monthlyLimit` (bypass when null).
  - Returns `{ ok: true }` or `{ ok: false, reason }` — never throws.
- Replace the client's direct `emitLoungeAudioEvent("connected_minutes", ...)` in `use-stream-lounge-audio.ts` with `reserveLoungeMinute`. When it returns `{ ok:false }`, call the new `onQuotaExhausted` callback (see §4). Other telemetry events keep their current path.

### 4. Client UX

- `use-stream-lounge-audio.ts`:
  - Add `quotaExhausted: boolean` and `minutesRemaining: number | null` to state.
  - On mount / roomId change, fetch `getLoungeAudioAccess`; if `!canJoinAudio`, set `error = { kind: "quota", ... }` and skip Stream `call.join()`.
  - Every minute-tick RPC failure flips `quotaExhausted = true` and calls `call.leave()`.
- `media-panel.tsx`:
  - Show a "Lounge audio time" chip near the join controls: `X of 600 min used this month · resets [date]` for Free.
  - When quota is exhausted or would block join: replace the "Join audio" button with a disabled state + `Link to /pricing` "Go Plus for unlimited Lounge time". Chat remains fully available (no gating on chat-only presence).

### 5. Fix `work_applications` privilege escalation (deferred from Wave 1)

Same migration. Current "self updates own application" policy allows a self-referential `status` subquery that the applicant can subvert — an applicant can set their own status to `approved`.

- Drop the existing `self updates own application` UPDATE policy.
- Replace with a policy that keeps `USING (applicant_user_id = auth.uid())` but the `WITH CHECK` also requires `applicant_user_id = auth.uid()` only — status protection moves to a trigger.
- Add `BEFORE UPDATE` trigger `work_applications_guard_status`:
  - If `NEW.status IS DISTINCT FROM OLD.status AND NOT is_work_owner(NEW.work_id, auth.uid())` → `RAISE EXCEPTION 'Only the work owner can change application status'`.
  - Same guard blocks changes to `work_id` and `applicant_user_id`.
- Call `manage_security_finding(mark_as_fixed)` after the migration runs.

### 6. Out of scope for this wave

- Backfill historical usage (rollup starts from the last 30 days of existing `connected_minutes` rows automatically since we key off `created_at`).
- Admin-side per-user reset (Wave 5 hardening).
- Copy sweeps on non-lounge pages (Wave 4).

### Verification

- Typecheck.
- Manual: as a Free user, `SELECT public.lounge_minutes_this_month(auth.uid())` before/after a minute tick.
- Manual: attempt `UPDATE work_applications SET status='approved' WHERE applicant_user_id = auth.uid()` — expect the trigger to raise.

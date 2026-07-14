
# Lounge WebRTC reliability hardening

Scoped to `src/hooks/use-media-room.tsx` (the sole peer-connection owner) plus a light signaling-shape extension. No SFU migration, no visual redesign, no room-cap change, no signaling-provider change (Supabase Realtime broadcast + presence stays as-is). Chat, Collabs, Work, screen share, PiP behavior preserved.

## Audit findings (what's actually wrong today)

Current negotiation shape:
- Lex-greater peer sends the initial offer. `onnegotiationneeded` is also gated to lex-greater. No polite/impolite roles, no rollback, no glare handling.
- `handleSignal("answer")` guards on `signalingState !== "stable"` but never rolls back; a duplicate/stale answer silently mismatches.
- ICE candidates arriving before `remoteDescription` are swallowed by a bare `try/catch` — no buffer.
- No per-connection generation id. A late signal from a closed PC, a previous room, or a previous browser session can hit `handleSignal` and be applied to whatever PC currently sits at `pcsRef.current.get(from)`.
- `iceConnectionState === "disconnected"` immediately triggers TURN upgrade — no grace period for a 2-second Wi-Fi blip.
- Recovery path is "tear down PC and rebuild with TURN," never `restartIce()`. That's more disruptive than needed and discards the direct path even for transient failures.
- Screen share: `pc.addTrack` on voice-only pairs triggers `onnegotiationneeded`, but the handler is gated to lex-greater. Lex-lesser side never renegotiates → screen never delivers to some peers.
- Signaling reconnect (channel `CHANNEL_ERROR` mid-call), tab visibility change, and `pageshow` from bfcache are not handled — the socket can be silently dead while the UI still shows "joined."
- `leave()` doesn't stamp a "this room is over" marker; a late signal racing the removeChannel could still be delivered to `handleSignal` from the buffered broadcast queue.

## Design

### 1. Deterministic negotiation roles (perfect-negotiation pattern)

- Compute `polite = myId < peerId` at PC creation. Store on a per-PC `Meta` record.
- Track `makingOffer` and `ignoreOffer` refs per PC.
- Rewrite `onnegotiationneeded`:
  - Set `makingOffer = true`, `createOffer()` (no options), `setLocalDescription()`, broadcast, `makingOffer = false` in `finally`. Both sides may attempt; collision is resolved on receipt.
  - Runs on **both** sides — no lex gate. This fixes screen-share addTrack for lex-lesser peers.
- Rewrite `handleSignal("offer")`:
  - `readyForOffer = !makingOffer && (signalingState === "stable" || isSettingRemoteAnswerPending)`
  - `offerCollision = !readyForOffer`
  - `ignoreOffer = !polite && offerCollision` → drop.
  - If polite and colliding: `setLocalDescription({type:"rollback"})` then `setRemoteDescription(offer)`, then create/send answer.
- `handleSignal("answer")`: if `ignoreOffer` set, drop; else `setRemoteDescription`. Clear `ignoreOffer`.
- Remove initial-offer scheduling for lex-greater from presence `join`/re-join loops; rely on `onnegotiationneeded` after `addTrack`. Keep a small kickstart: after `addTrack`, if `signalingState==="stable"` and no ICE progress within 500ms, force one offer to cover browsers that skip the event.

### 2. Connection generations

Add three ids threaded through every signal:
- `sessionId`: random uuid, generated once per `joinWithMode` invocation, stored in `sessionIdRef`. Cleared on `leave()`.
- `pcGen`: monotonically increasing counter incremented every time we create a PC for a given peerId (recreations, TURN swap). Stored on the PC's Meta.
- `roomId`: the current room. Already implicit via channel scoping but included so a stale queued broadcast from a previous channel can't land.

Signal payload gains `{ room, sess, gen, targetSess }`.
- Sender fills them from its refs / peer meta at emit time.
- `handleSignal` drops the message unless:
  - `room === roomIdRef.current`
  - `sess` (remote) matches the peer's currently-known sess (learned on first offer/presence)
  - `targetSess` (if set) matches our `sessionIdRef.current`
  - `gen >= currentGen` for that peer (older-gen ICE and SDP discarded)

`leave()` sets `sessionIdRef.current = null` and increments a `teardownEpochRef`; `handleSignal` short-circuits when session is null. Idempotent.

### 3. ICE buffer + generation-aware candidate handling

- Per-PC `pendingIceRef: Map<pcGen, RTCIceCandidateInit[]>`.
- `handleSignal("ice")`:
  - Locate PC; if none or `gen` mismatches → drop.
  - If `pc.remoteDescription` not yet set → push into buffer keyed by gen.
  - Else `addIceCandidate` with try/catch; on error, log once per pair and continue (never fatal, never propagates).
- After every `setRemoteDescription`, drain that PC's buffer for its current gen; discard buffers for other gens.
- End-of-candidates (empty candidate) accepted, forwarded to `pc.addIceCandidate(null-ish)` where supported, otherwise ignored.

### 4. ICE state interpretation with grace + restart

Replace the current immediate-upgrade logic:

- `disconnected`: start a per-PC `disconnectTimerRef` (5s). If state returns to `connected`/`completed`, cancel. If still `disconnected`/`failed` at expiry AND we haven't restarted recently:
  1. Refresh TURN creds if `turnExpiresAt < now + 60s` (already implemented; extend to the restart path).
  2. Call `pc.restartIce()` on both sides implicitly; the polite/impolite handler will negotiate.
  3. If polite/impolite happens to be us as the offerer, `onnegotiationneeded` will fire an ICE-restart offer.
- Bounded: per-PC `restartAttemptsRef`, max 2 restart attempts within 30s. After exhaustion → run existing TURN teardown-and-recreate as a last resort. After that → `closePeer` for that peer only, keep the rest of the mesh alive.
- `failed`: same escalation entry point (skip the 5s wait).
- Concurrency guard: `restartInFlightRef.has(peerId)` prevents overlapping restart attempts.

### 5. Signaling-socket & network transition recovery

New `revalidate()` function, idempotent, cancellable:

Triggers:
- `document.visibilitychange` → visible after being hidden > 10s
- `window.pageshow` (bfcache restore)
- `online` event
- Realtime channel `CHANNEL_ERROR`/`TIMED_OUT` while `joined === true`

Behavior:
- If channel is dead: `supabase.removeChannel`, recreate with same name, re-subscribe, re-`track` presence with the same session id.
- After presence resync:
  - For every peer in presence not in `pcsRef`: create PC (perfect negotiation drives offers).
  - For every PC not in presence: `closePeer`.
  - For every surviving PC whose `iceConnectionState` is not `connected|completed`: schedule an ICE restart via `restartIce()`.
- Local tracks re-verified; if `readyState === "ended"` (device revoked on sleep), attempt a silent `getUserMedia` re-acquire and `replaceTrack` on every sender. If that fails, surface a discreet "reconnecting" error state (do not kick the user out).

### 6. Screen share / track changes

- Keep `replaceTrack` fast-path for video peers.
- For voice-only pairs, keep the `addTrack` — the new bilateral `onnegotiationneeded` will actually run now.
- On screen stop, keep `replaceTrack(camTrack)`. If camTrack is null (user was in voice mode when share started), `sender.replaceTrack(null)` and remove the extra sender via `pc.removeTrack(sender)` so onnegotiationneeded fires and the stray m-section is dropped.
- Guard against double `startScreenShare` clicks with a `screenBusyRef`.
- `screen` broadcast still tells peers who is sharing for the UI; no new SDP dependency.

### 7. Skip / Leave / unmount

- `leave()`:
  1. Bump `teardownEpochRef`, null `sessionIdRef`.
  2. Cancel all `disconnectTimerRef`, `pairCheckTimersRef`, `restartInFlightRef`, `screenBusyRef` timers/flags.
  3. `closePeer` each PC (already fires relay-end telemetry).
  4. Clear `pendingIceRef`.
  5. Untrack presence, `removeChannel`.
  6. Stop local + screen tracks (existing).
- `handleSignal` first line: `if (!sessionIdRef.current) return;`
- `HopButton` already stamps recent-exit and drops presence; keep as-is.

### 8. Signal payload contract

Extend `SignalEvent` (backward-tolerant: new fields optional; missing fields treated as "unknown", dropped only if `roomId`/`gen` mismatch is provable). Version bump not needed — same channel is per-room so cross-room contamination is already unlikely; the fields harden the case where a user rapidly rejoins the same room.

```ts
type SignalBase = { room: string; sess: string; gen: number; targetSess?: string };
type SignalEvent =
  | SignalBase & { type: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | SignalBase & { type: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | SignalBase & { type: "ice"; from: string; to: string; candidate: RTCIceCandidateInit }
  | { type: "speaking"; from: string; speaking: boolean; room: string; sess: string }
  | { type: "screen"; from: string; active: boolean; room: string; sess: string };
```

## Files changed

- `src/hooks/use-media-room.tsx` — all of the above. Introduces small internal helpers (`makePeerMeta`, `revalidate`, `scheduleIceRestart`) but no new exported surface.
- No changes to `src/routes/lounge.$id.tsx`, `HopButton`, `instant.functions.ts`, TURN mint fn, telemetry schema, presence schema, or Supabase migrations.

## Acceptance test paths

Manual, in dev with two browser profiles (A/B):
1. Both join simultaneously → single PC pair, one direction of offer wins, both end `connected`.
2. B starts screen share while A also toggles camera → no `InvalidStateError`, both see shares/cam.
3. Force `iceConnectionState==="disconnected"` by killing B's Wi-Fi for 3s → recovers without teardown, no toast, no black tile.
4. Kill B's network 20s → A sees restartIce attempts (log), then TURN swap, then failure isolated to B; A's other peers stay connected.
5. Suspend A's laptop 60s → on wake, presence rebinds, PCs revalidate; if tracks dead, silent re-acquire.
6. Rapid Skip → new room signals never touch old PCs (session id mismatch).
7. In `VITE_WEBRTC_MODE=force-turn`, every pair goes relay from t=0 (unchanged).

## Non-goals

- No SFU. No new signaling transport. No cap change. No UI redesign. No admin console. No new tables. No changes to bandwidth governor, TURN mint rate limit, or telemetry schema.

## Known browser limitations that will remain

- Safari < 16: `setParameters({ degradationPreference })` and `restartIce()` are partial; we retain existing try/catch noops. Recovery on Safari 15 falls back to teardown-and-recreate.
- iOS Safari backgrounding still suspends WebRTC entirely; revalidate on foreground is the best we can do.
- Firefox does not fire `onicecandidateerror` — diagnostics silently absent there; not a regression.

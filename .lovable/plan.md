
# Lounge 5-mesh capacity, quality, and graceful-degradation hardening

Scope is narrow: measurement + adaptive policy + atomic cap enforcement. Preserves mesh + Cloudflare TURN + 5-cap + Chat/Collabs/Work/screen/PiP. No SFU. No visual redesign.

## Audit findings from current code

- **Cap enforcement has a race**: `joinSpecificInstantRoom` does a `count` check then returns success; the client separately upserts `instant_presence`. Two simultaneous joins each see count=4, both proceed, room ends at 6. Same race in `join_medium_lounge` RPC path (matchmaker) and in direct-link entry.
- **Per-peer metrics are event-only**: telemetry writes one row on connect and one update on relayed close (`recordWebrtcConnection` / `recordWebrtcRelayEnd`). RTT, loss, jitter, resolution, frames dropped, ICE restart count are never captured.
- **Stats poller only detects `qualityLimitationReason==="bandwidth"`** and steps camera down. Never steps back up. Never drops video entirely for a genuinely stuck peer — the pair either sputters video forever or hits the ICE-restart escalation.
- **No audio-only fallback state** for a peer that is clearly bandwidth-broken but reachable — audio priority is a stated product goal but not enforced by code.
- **`replaceTrack` on stopScreenShare leaves stray null-track senders** on peers who were voice-only when share started — already patched in the previous pass, but not verified via metric.
- **Hidden peer video elements**: not audited. `<video>` elements decoded even when off-screen consume CPU on Chromium.
- **Room-size profile table** (`mesh-bitrate.ts`) is sound but the 2-peer row allows 1200 kbps up × 1 = 1.2 Mbps which is fine; 5-peer row is 300×4 = 1.2 Mbps up — reasonable. Screen-share sizes need validation against a real 5-way test but no immediate change proposed.

## Design

### 1. Atomic cap enforcement (SQL)

Add migration with a SECURITY DEFINER RPC `claim_lounge_slot(_room_id uuid, _user_id uuid, _cap int)` that:

1. Takes a `pg_advisory_xact_lock(hashtext('lounge-slot:' || _room_id))`.
2. `DELETE FROM instant_presence WHERE last_seen_at < now() - interval '60 seconds'` (scoped to that room) — sweeps stale before counting.
3. Reads current live count.
4. If user already present → upsert `last_seen_at`, return `{status: 'rejoined', count}`.
5. Else if `count >= cap` → return `{status: 'full', count}` (no throw — client handles).
6. Else insert presence row, return `{status: 'joined', count: count+1}`.

RPC exposed to `authenticated`; SECURITY DEFINER because it needs to bypass RLS's normal per-row auth for the count. Return type is a JSON row.

Update `joinSpecificInstantRoom`, `joinRoom` (lounge matchmaker), `joinMediumLounge` to call the RPC and only return `{roomId}` on `joined`/`rejoined`. On `full`, throw the same `"Room is full"` error the client already handles.

Client-side (`channel-view.tsx`) presence upsert stays as-is for heartbeat, but the *first* insert on room-entry is replaced by the RPC call so cap is enforced at exactly one atomic point.

### 2. Rollback on partial join

In `use-media-room.joinWithMode`: if the server call throws `Room is full` between discovery and entry, the current code sets `error` and returns — good. Extend to also:
- Untrack the media Realtime presence if the channel was created.
- `supabase.from("instant_presence").delete()` for our user_id (safety net; the RPC didn't insert us but the media channel presence needs cleanup).
- Route back to `/lounge` with a toast `Room filled while you were joining.` (Handled in `lounge.$id.tsx`.)

### 3. Per-peer periodic getStats sampler

Extend the existing `startStatsPoller` (already runs every 4s). For each PC per tick, collect:

- Outbound RTP video: `bytesSent`, `framesEncoded`, `framesSent`, `framesPerSecond`, `frameWidth/Height`, `qualityLimitationReason`, `qualityLimitationDurations`
- Outbound RTP audio: `bytesSent`, `packetsSent`, `retransmittedPacketsSent`
- Inbound RTP video: `bytesReceived`, `framesDecoded`, `framesDropped`, `frameWidth/Height`, `framesPerSecond`, `jitter`, `packetsLost`
- Inbound RTP audio: `bytesReceived`, `jitter`, `packetsLost`, `concealedSamples`, `totalSamplesReceived`
- Candidate-pair: `currentRoundTripTime`, `availableOutgoingBitrate`

Compute per-sender/receiver *deltas* against the previous tick (raw counters are monotonic). Keep a per-PC ring buffer of the last 5 samples for the audio-first policy (below); do NOT send every sample to the server.

Batch-flush an aggregated **snapshot every 20s** (5 samples averaged) to a new server fn `recordWebrtcSnapshot`. Fields (all optional): `event_id` (from initial connect insert), `avg_rtt_ms`, `avg_outbound_kbps_video`, `avg_outbound_kbps_audio`, `avg_inbound_kbps_video`, `avg_inbound_kbps_audio`, `packet_loss_pct_out`, `packet_loss_pct_in`, `jitter_ms_in`, `frames_dropped`, `outbound_width`, `outbound_height`, `outbound_fps`, `quality_limitation_reason`, `ice_restarts`, `reconnect_count`. Stops sending as soon as the PC closes (existing `pc.close()` path already halts the poller when the map empties).

**Ice/reconnect counters**: bump `meta.reconnectCount++` on each `scheduleIceRestart` invocation. Include in the snapshot.

**Schema**: extend `webrtc_connection_events` with the snapshot columns (all nullable) rather than creating a second table — snapshots update the existing row via `id`. Adds ~12 columns; migration + Data API grants (already granted to `authenticated` insert/update via existing policy).

### 4. Audio-first degradation ladder

New per-PC `HealthState = "ok" | "degraded" | "video-off"`. Transitions use hysteresis (2 consecutive samples over threshold to enter, 3 consecutive under to exit) so we never oscillate.

Signals per PC (per 4s sample):
- `outLossPct = retransmittedPacketsSent + failed / packetsSent` — proxy for outbound loss
- `inLossPct = packetsLost / (packetsLost + packetsReceived)`
- `rtt = currentRoundTripTime`
- `qlr = qualityLimitationReason`

Ladder (state machine on the sending side; we only control what we send):

1. **ok** (default). Bitrate profile from `pickProfile(peers, share)`.
2. **degraded** — enter when 2 consecutive samples show any of: `qlr==="bandwidth"`, or `outLossPct > 5%`, or `rtt > 400ms`.
   - Apply the existing `stepDown()` to camera (already implemented). New: additionally cap audio *senders* to Opus 16 kbps DTX-friendly (`maxBitrate: 16000` via `setParameters`). Preserve audio flow — we're pinching video and being kind to audio's headroom.
3. **video-off** — enter when 2 more consecutive samples still show `qlr==="bandwidth"` OR `outLossPct > 15%` AFTER already stepped down to the floor profile.
   - `sender.replaceTrack(null)` for the video sender on THAT peer only (not on other pairs). No renegotiation; the receiving peer sees the video freeze/black naturally.
   - Broadcast a small `{ type: "video-off", from: myId, to: peerId, on: false }` signal so the affected peer's UI shows a discreet "Video paused for reliability" chip on my tile.
   - Camera track stays on locally; the pair just doesn't get it.
4. **recover** — after 3 consecutive good samples (rtt<200ms AND outLossPct<1% AND qlr!=="bandwidth"), re-`replaceTrack(camTrack)` and rebudget upward via `stepDown` reversal (clear `adaptiveFloorRef`).

Cross-peer coordination: if my aggregate outbound bandwidth is limited (checked by looking at the *worst* peer's `qlr` AND the room count), I do NOT downgrade video to *every* peer just because one is weak. The step-down is per-sender via `sender.setParameters`; only the "video-off" state is per-pair.

If EVERY peer is `video-off` for me AND my mode is video, transition my local UI to a soft audio-only banner ("Reliability mode — video paused across the room"). One-click "Try video again" resets floors and re-enables all senders. Preserves user autonomy.

### 5. Room-size-aware quality (already partially present)

Keep the `mesh-bitrate.ts` profile table but re-check the numbers against a real 5-way telemetry snapshot after this change lands. Concrete tweaks now:

- 5-peer idle profile stays 300 kbps/15 fps/270p — total up 1.2 Mbps for cam-only.
- 5-peer sharing profile keeps 90+1000 kbps → total up ~4.4 Mbps for the sharer, ~360 kbps for lurkers. Add a note that this exceeds typical asymmetric residential upstreams; the adaptive ladder above will pull the sharer down as `qlr` fires.
- Add explicit `contentHint = "text"` for screen-share track (currently "detail" — "text" hints the encoder to preserve edge sharpness for slides/code over motion). Verified safe on Chromium/Firefox; noop on Safari.

### 6. Hidden peer video suppression

In the Lounge UI, when a `<video>` element for a peer is offscreen or the tile is collapsed (mobile carousel), pause decoding: `videoEl.pause()` on `IntersectionObserver`'s `isIntersecting=false`, `videoEl.play()` back on visibility. Not a mesh change; a UI-layer helper. Adds one small hook `useVisibleVideo(videoRef)` used by peer-tile components. Optional and reversible.

### 7. Duplicate-sender audit

Add a dev-only invariant check at the top of each stats poll: for every PC, count video senders. If >1 (which should be impossible after screen-share stop), warn once and remove the null-track sender via `pc.removeTrack`. Ship the warning gated to `import.meta.env.DEV` so we surface bugs in dev without shipping console noise.

### 8. Telemetry: reconnect + ICE-restart counters in existing row

`webrtc_connection_events` migration adds:
- `snapshot_count` (int, default 0) — bumped per aggregate flush
- `avg_rtt_ms`, `avg_outbound_kbps_video`, `avg_outbound_kbps_audio`, `avg_inbound_kbps_video`, `avg_inbound_kbps_audio`, `packet_loss_pct_out`, `packet_loss_pct_in`, `jitter_ms_in`, `frames_dropped`, `outbound_width`, `outbound_height`, `outbound_fps` (numeric/int, nullable)
- `quality_limitation_reason` (text, nullable)
- `ice_restarts` (int, default 0)
- `reconnect_count` (int, default 0)
- `health_state_terminal` (text, nullable) — last observed state (`ok`/`degraded`/`video-off`)

Snapshot server fn `recordWebrtcSnapshot({ eventId, ...fields })` updates the row with EWMA-style overwrite (server just writes the latest averages — client computes them).

## Files changed

- `supabase/migrations/<timestamp>_lounge_cap_and_snapshot.sql` — `claim_lounge_slot` RPC + GRANT + `webrtc_connection_events` column additions.
- `src/lib/instant.functions.ts` — replace count-then-insert with RPC in `joinSpecificInstantRoom` and any medium/join paths that hand back a roomId.
- `src/lib/turn.functions.ts` — add `recordWebrtcSnapshot` server fn.
- `src/hooks/use-media-room.tsx` — extend `startStatsPoller` with per-PC delta collection + snapshot flush, health-state machine, audio-only fallback + `replaceTrack(null)` per-peer, reconnect_count bumping, duplicate-sender dev warning, contentHint "text" for screen share.
- `src/components/channel-view.tsx` — remove initial presence insert (RPC does it), keep heartbeat upsert.
- `src/routes/lounge.$id.tsx` — handle new `full` outcome with toast + redirect to `/lounge`.
- New `src/hooks/use-visible-video.ts` — IntersectionObserver pause helper.
- Peer-tile component (`src/components/media-panel.tsx` or wherever remote `<video>` renders — read to confirm before wiring) uses the helper.
- `src/integrations/supabase/types.ts` — regenerated automatically by migration.

## Acceptance test paths (manual, staging)

1. Two browser profiles hit `/lounge/<id>` simultaneously when count=4 → exactly one enters, other sees "Room is full", no orphan presence row.
2. 5-participant room with 5 cams for 3 min → dashboard shows 10 pair snapshots per browser, RTT/loss/fps recorded.
3. Introduce artificial loss on one peer (chrome://webrtc-internals bandwidth throttle) → that pair reaches `degraded` then `video-off` within ~15s while other 3 pairs remain green. No re-negotiation on healthy peers.
4. Recovery: remove throttle → within ~15s the paused pair reverts to `ok`.
5. Screen-share for 90s at 5 peers → sharer's cam collapses per profile, screen holds at readable fps.
6. Rapid Skip → PCs closed → snapshot flush not attempted for closed PCs.

## Non-goals

- No SFU. No cap change. No new signaling. No visual overhaul. No changes to matchmaker room selection strategy. No hard-coded per-region policies.

## Known limitations that will remain

- Safari < 16: `setParameters({ maxBitrate })` for audio may throw; try/caught, degrades to no-op (video ladder still works).
- iOS Safari backgrounded: WebRTC suspends fully; snapshot poller pauses via existing visibility handling.
- Firefox: `qualityLimitationReason` reporting differs; ladder uses OR of `qlr` and `outLossPct`, so Firefox degrades via loss threshold.
- Snapshot writes are best-effort — a failed update never affects the call.

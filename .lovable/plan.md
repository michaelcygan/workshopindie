# Pass 10 — Mesh chat bandwidth optimization

## The problem

Workshop's live room is a **full WebRTC mesh** (cap 5) in `src/hooks/use-media-room.tsx`. Every sender uploads its track to N-1 peers, so my upload cost = my-bitrate × (N-1). Default browser cam encodes at ~1.5–2.5 Mbps and screen capture at 2.5–8 Mbps with no caps anywhere in our code. With 5 participants and one screensharer that's:

- Sharer upload: 8 Mbps × 4 = 32 Mbps (kills most home uplinks)
- Each cam upload: 2 Mbps × 4 = 8 Mbps
- Aggregate per peer download: 8 + 2×3 = 14 Mbps

This will brown out the mesh well before we hit the participant cap. Today we don't touch encoder parameters at all — no `setParameters`, no `contentHint`, no degradation preference. We need a **bandwidth governor** that picks per-track caps based on the current room shape and applies them every time the shape changes.

## The plan

### 1. Define a mesh budget (`src/lib/mesh-bitrate.ts`, new)

Single source of truth. Pure functions, no DOM, easy to unit-reason about.

```text
TARGET_UPLINK_KBPS = 2500   // assume modest home uplink; conservative
TARGET_DOWNLINK_KBPS = 6000

Per (peerCount, screenActive) → returns:
  { camKbps, camFps, camMaxHeight, screenKbps, screenFps }
```

Profiles (peerCount = total in room incl. self):

| peers | screen | cam kbps | cam fps | cam height | screen kbps | screen fps |
|-------|--------|----------|---------|------------|-------------|------------|
| 2     | no     | 1200     | 30      | 720        | —           | —          |
| 2     | yes    | 250      | 15      | 360        | 1800        | 15         |
| 3     | no     | 700      | 24      | 540        | —           | —          |
| 3     | yes    | 180      | 10      | 270        | 1500        | 12         |
| 4     | no     | 450      | 20      | 360        | —           | —          |
| 4     | yes    | 120      | 8       | 180        | 1200        | 10         |
| 5     | no     | 300      | 15      | 270        | —           | —          |
| 5     | yes    | 90       | 8       | 180        | 1000        | 8          |

Invariant the table enforces: `(camKbps × (peers-1)) + (screenKbps × (peers-1)) ≤ TARGET_UPLINK_KBPS × 0.8` for the sharer; cam-only senders stay ≤ TARGET_UPLINK_KBPS × 0.6. Numbers picked so screenshare always nets out below the mesh threshold the user asked about.

### 2. Apply the budget to every sender (`use-media-room.tsx`)

Add `applyBudget()` that walks `pcsRef` and for each pc:

- Finds the video sender. Calls `sender.getParameters()`, sets `encodings[0].maxBitrate`, `maxFramerate`, `scaleResolutionDownBy` (derived from current track height vs target height), `degradationPreference = "maintain-framerate"` for screen / `"balanced"` for cam, then `sender.setParameters(...)`.
- Sets `track.contentHint`: `"detail"` for screen (text legibility), `"motion"` for cam.
- For local capture, also calls `videoTrack.applyConstraints({ frameRate, height })` so the source itself downsamples (saves encode CPU on top of bitrate cap).

Call `applyBudget()` from:

- End of `joinWithMode` (initial publish).
- Presence sync handler when peer count changes (existing block ~line 490).
- `startScreenShare` and `stopScreenShare` (after the replaceTrack loop).
- Receipt of remote `screen` signal events (peer started/stopped sharing → re-budget my cam down even though *I'm* not the sharer, because aggregate downlink across peers matters too).

### 3. Tighten `getDisplayMedia` (`startScreenShare`)

Replace the current `{ frameRate: { ideal: 15, max: 30 } }` with constraints driven by the budget:

```text
video: {
  frameRate: { ideal: profile.screenFps, max: profile.screenFps },
  width:  { max: 1920 },
  height: { max: 1080 },
  // contentHint set on the track after capture
}
```

### 4. Adaptive fallback on congestion

Add a lightweight `getStats()` poller (every 4s) on each pc. If `outbound-rtp` reports `qualityLimitationReason === "bandwidth"` or `packetsLost / packetsSent > 3%` sustained across 2 samples, **step down one row in the profile table** for that peer's outbound (per-sender cap, not global), and remember the floor for that session. Step back up only on `setMode`/`startScreenShare` boundaries — we don't want oscillation.

### 5. UI surfacing (small, opinionated)

In `workshop-tools-panel.tsx`, when screenshare is live, add a one-line status under the share button:

```text
Sharing • cams reduced to keep the room smooth
```

No knobs, no quality picker. The whole point of a solo-founder app is the governor is automatic.

### 6. Out of scope for this pass

- SFU / mediasoup migration — that's the v2 answer when we want 6+ peers or recording.
- Simulcast — only useful with an SFU; in a mesh every receiver wants the same layer, so a single capped encoding is correct.
- Audio bitrate — Opus default 32 kbps is already negligible vs video.

## Files touched

- **new** `src/lib/mesh-bitrate.ts` — profile table + `pickProfile(peers, screenActive)`.
- **edit** `src/hooks/use-media-room.tsx` — `applyBudget()` helper, hook it into join / presence-change / screen start+stop / remote `screen` signal; add `getStats()` poller; tighten `getDisplayMedia` constraints; set `contentHint`.
- **edit** `src/components/workshop-tools-panel.tsx` — one-line "cams reduced" status when `isScreenSharing || screenSharerId`.

No schema changes, no new server functions, no UI surgery beyond the one status line.

## How we'll know it worked

Open a 3-peer room (3 browsers locally), start screenshare from one, watch `chrome://webrtc-internals`:
- Each cam `outbound-rtp` bytes-sent slope drops to ~180 kbps after share starts.
- Screen `outbound-rtp` caps at ~1500 kbps.
- `qualityLimitationReason` settles to `"none"` or `"cpu"`, not `"bandwidth"`.
- Stopping the share restores cams to the 3-peer no-screen profile within ~1s.

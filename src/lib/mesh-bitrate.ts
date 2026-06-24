/**
 * Mesh bandwidth governor.
 *
 * Workshop live rooms are a full WebRTC mesh capped at 5 participants. Each
 * sender uploads its track to N-1 peers, so my upload cost scales with the
 * room size. Browsers default to ~1.5–2.5 Mbps for camera and 2.5–8 Mbps for
 * screen capture — at 5 peers with one screenshare that's >30 Mbps of upload,
 * which is well past most home uplinks.
 *
 * This module is the single source of truth for what bitrate / framerate /
 * resolution each track is allowed to use, given:
 *   - peers: total participants in the room INCLUDING self (1–5)
 *   - screenActive: whether anyone (self or peer) is currently sharing
 *
 * The hook applies these caps to every RTCRtpSender on every peer connection
 * whenever the room shape changes (join/leave, share start/stop). Pure
 * functions, no DOM — easy to reason about and unit-test.
 */

export type BitrateProfile = {
  camKbps: number;
  camFps: number;
  camMaxHeight: number;
  screenKbps: number;
  screenFps: number;
};

/**
 * Profile table. Picked so that for the sharer
 *   (camKbps + screenKbps) × (peers - 1) ≤ ~2 Mbps
 * and for non-sharers, camKbps × (peers - 1) ≤ ~1.5 Mbps.
 *
 * Indexed by clamp(peers, 2, 5). Solo (peers=1) returns the 2-peer profile —
 * harmless, nothing is published yet anyway.
 */
const PROFILES_IDLE: Record<number, BitrateProfile> = {
  2: { camKbps: 1200, camFps: 30, camMaxHeight: 720, screenKbps: 0, screenFps: 0 },
  3: { camKbps: 700,  camFps: 24, camMaxHeight: 540, screenKbps: 0, screenFps: 0 },
  4: { camKbps: 450,  camFps: 20, camMaxHeight: 360, screenKbps: 0, screenFps: 0 },
  5: { camKbps: 300,  camFps: 15, camMaxHeight: 270, screenKbps: 0, screenFps: 0 },
};

const PROFILES_SHARING: Record<number, BitrateProfile> = {
  2: { camKbps: 250, camFps: 15, camMaxHeight: 360, screenKbps: 1800, screenFps: 15 },
  3: { camKbps: 180, camFps: 10, camMaxHeight: 270, screenKbps: 1500, screenFps: 12 },
  4: { camKbps: 120, camFps: 8,  camMaxHeight: 180, screenKbps: 1200, screenFps: 10 },
  5: { camKbps: 90,  camFps: 8,  camMaxHeight: 180, screenKbps: 1000, screenFps: 8  },
};

export function pickProfile(peers: number, screenActive: boolean): BitrateProfile {
  const clamped = Math.max(2, Math.min(5, peers || 2));
  return (screenActive ? PROFILES_SHARING : PROFILES_IDLE)[clamped];
}

/**
 * Step one row tighter (toward the 5-peer profile) for adaptive fallback when
 * `qualityLimitationReason === "bandwidth"` is sustained. Returns null when
 * already at the floor so callers can stop polling.
 */
export function stepDown(p: BitrateProfile, screenActive: boolean): BitrateProfile | null {
  const table = screenActive ? PROFILES_SHARING : PROFILES_IDLE;
  const rows = [table[2], table[3], table[4], table[5]];
  const idx = rows.findIndex((r) => r.camKbps === p.camKbps && r.screenKbps === p.screenKbps);
  if (idx < 0 || idx >= rows.length - 1) return null;
  return rows[idx + 1];
}

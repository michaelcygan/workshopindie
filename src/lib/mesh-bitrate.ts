/**
 * Mesh bandwidth governor.
 *
 * Audio-first Lounge (V1): full WebRTC mesh capped at 10 audio-connected
 * participants + one screen-share track. Camera video no longer exists;
 * `cam*` fields remain in the shape only for compatibility with the current
 * useMediaRoom hook and will be removed in the next wave once the hook is
 * rewritten to a pure audio+screen interface.
 *
 * Each screen sender uploads to (audioPeers - 1) receivers, so the total
 * upload budget for the sharer is:
 *   screenKbps × (audioPeers - 1) + audioKbps × (audioPeers - 1)
 * We aim to keep this comfortably under ~2 Mbps for the sharer at 10 peers.
 *
 * NOTE: `peers` refers to *audio-connected* participants, NOT total room
 * seat occupancy. Chat-only participants do not affect mesh cost.
 */

export type BitrateProfile = {
  /** Legacy — kept as the audio ceiling (~28 kbps voice). Not a camera. */
  camKbps: number;
  /** Legacy — unused in the audio-first hook; kept as a shape stub. */
  camFps: number;
  /** Legacy — unused in the audio-first hook; kept as a shape stub. */
  camMaxHeight: number;
  screenKbps: number;
  screenFps: number;
};

/**
 * IDLE = no active screen share. Only audio flows.
 * Indexed by clamp(audioPeers, 2, 10). Solo returns the 2-peer profile.
 */
const AUDIO_ONLY_KBPS = 28;
const AUDIO_ONLY_FALLBACK: BitrateProfile = {
  camKbps: AUDIO_ONLY_KBPS,
  camFps: 0,
  camMaxHeight: 0,
  screenKbps: 0,
  screenFps: 0,
};

const PROFILES_IDLE: Record<number, BitrateProfile> = {
  2: { ...AUDIO_ONLY_FALLBACK },
  3: { ...AUDIO_ONLY_FALLBACK },
  4: { ...AUDIO_ONLY_FALLBACK },
  5: { ...AUDIO_ONLY_FALLBACK },
  6: { ...AUDIO_ONLY_FALLBACK },
  7: { ...AUDIO_ONLY_FALLBACK },
  8: { ...AUDIO_ONLY_FALLBACK },
  9: { ...AUDIO_ONLY_FALLBACK },
  10: { ...AUDIO_ONLY_FALLBACK },
};

/**
 * SHARING = one participant is presenting a screen. Audio remains protected
 * (never degraded); the screen ladder shrinks as audio-mesh size grows.
 *
 *   2 peers:    1600 kbps @ 12 fps
 *   3–4 peers:   800 kbps @ 10 fps
 *   5–6 peers:   450 kbps @  8 fps
 *   7–8 peers:   300 kbps @  6 fps
 *   9–10 peers:  220 kbps @  5 fps
 */
const PROFILES_SHARING: Record<number, BitrateProfile> = {
  2:  { camKbps: AUDIO_ONLY_KBPS, camFps: 0, camMaxHeight: 0, screenKbps: 1600, screenFps: 12 },
  3:  { camKbps: AUDIO_ONLY_KBPS, camFps: 0, camMaxHeight: 0, screenKbps:  800, screenFps: 10 },
  4:  { camKbps: AUDIO_ONLY_KBPS, camFps: 0, camMaxHeight: 0, screenKbps:  800, screenFps: 10 },
  5:  { camKbps: AUDIO_ONLY_KBPS, camFps: 0, camMaxHeight: 0, screenKbps:  450, screenFps:  8 },
  6:  { camKbps: AUDIO_ONLY_KBPS, camFps: 0, camMaxHeight: 0, screenKbps:  450, screenFps:  8 },
  7:  { camKbps: AUDIO_ONLY_KBPS, camFps: 0, camMaxHeight: 0, screenKbps:  300, screenFps:  6 },
  8:  { camKbps: AUDIO_ONLY_KBPS, camFps: 0, camMaxHeight: 0, screenKbps:  300, screenFps:  6 },
  9:  { camKbps: AUDIO_ONLY_KBPS, camFps: 0, camMaxHeight: 0, screenKbps:  220, screenFps:  5 },
  10: { camKbps: AUDIO_ONLY_KBPS, camFps: 0, camMaxHeight: 0, screenKbps:  220, screenFps:  5 },
};

export function pickProfile(peers: number, screenActive: boolean): BitrateProfile {
  const clamped = Math.max(2, Math.min(10, peers || 2));
  return (screenActive ? PROFILES_SHARING : PROFILES_IDLE)[clamped];
}

/**
 * Adaptive fallback: step one row tighter (toward the 10-peer profile) when
 * `qualityLimitationReason === "bandwidth"` is sustained. Audio is never
 * degraded — only the screen sender shrinks. Returns null at the floor.
 */
export function stepDown(p: BitrateProfile, screenActive: boolean): BitrateProfile | null {
  const table = screenActive ? PROFILES_SHARING : PROFILES_IDLE;
  const rows = [2, 3, 4, 5, 6, 7, 8, 9, 10].map((k) => table[k]);
  const idx = rows.findIndex(
    (r) => r.camKbps === p.camKbps && r.screenKbps === p.screenKbps,
  );
  if (idx < 0 || idx >= rows.length - 1) return null;
  return rows[idx + 1];
}

/**
 * v1 feature flags — single source of truth for UI gating.
 *
 * These hide UI mount points without deleting code. Tables, server
 * functions, and types stay intact so flipping a flag re-enables the
 * feature without archaeology.
 *
 * Posture for launch: keep the surface minimal. Re-enable a flag when
 * (a) there's a user need that justifies the cognitive load, or
 * (b) network density makes the feature meaningful.
 */
export const FLAGS = {
  /** Paid surfacing on works/collabs. Re-enable once the feed has volume. */
  BOOSTS: false,
  /** Peer endorsements on works/collabs. Re-enable when a social graph exists. */
  VOUCHES: false,
  /** Per-room recorder identity tabs. Re-enable when recording is a feature users ask for. */
  RECORDER_PERSONAS: false,

  /** Always-on, listed for visibility. */
  REFERRALS: true,
  PLUS: true,
  ROOM_PINS: true,
  LINEUP: true,
} as const;

export type FlagKey = keyof typeof FLAGS;

export function isEnabled(flag: FlagKey): boolean {
  return FLAGS[flag];
}

/**
 * Lounge invariants shared across client and server-safe code.
 *
 * The database (instant_rooms.participant_cap + claim_lounge_slot / join_lounge)
 * remains the authoritative admission gate. This constant is for UI, client-side
 * validation, and default room provisioning.
 */
export const LOUNGE_CAP = 10;

/**
 * How a person is participating in a Lounge.
 *  - "chat"  → room seat + presence + chat + panels, NO getUserMedia, NO peer connections.
 *  - "audio" → everything in "chat" plus the WebRTC audio mesh (optionally screen sharing).
 *
 * Room membership and audio membership are intentionally separate concerns.
 */
export type LoungeParticipation = "chat" | "audio";

/** Local-storage key for the "join audio on entry" preference. */
export const LOUNGE_AUDIO_ON_ENTRY_KEY = "workshop:lounge-audio-on-entry";

/**
 * Normalize legacy URL / storage `mode` values into the new participation vocabulary.
 * Cameras no longer exist — a stale `mode=video` link becomes chat, never a camera.
 */
export function normalizeLoungeMode(
  raw: string | null | undefined,
): LoungeParticipation {
  if (raw === "audio" || raw === "voice") return "audio";
  return "chat";
}

/**
 * Lounge invariants shared across client and server-safe code.
 *
 * The database (instant_rooms.participant_cap + claim_lounge_slot / join_lounge)
 * remains the authoritative admission gate. These constants are for UI,
 * client-side validation, and default room provisioning.
 */

/** Total people allowed in a Lounge (chat + audio combined). */
export const LOUNGE_CAP = 20;

/** Cap on active microphone (speaker) seats in one Lounge. */
export const LOUNGE_SPEAKER_CAP = 10;

/** Screen sharing is retired. Kept as an export for legacy callsites. */
export const LOUNGE_SCREEN_SHARE_ENABLED = false;

/**
 * Live-audio transport. Stream SFU is the only supported provider;
 * the legacy WebRTC mesh has been removed. This type/const are kept as
 * exports so downstream imports keep compiling; they always resolve to
 * "stream".
 */
export type LoungeAudioProvider = "stream";
export const LOUNGE_AUDIO_PROVIDER: LoungeAudioProvider = "stream";

/**
 * How a person is participating in a Lounge.
 *  - "chat"  → room seat + presence + chat + panels, NO getUserMedia.
 *  - "audio" → everything in "chat" plus the Stream audio transport.
 */
export type LoungeParticipation = "chat" | "audio";

/** Local-storage key for the "join audio on entry" preference. */
export const LOUNGE_AUDIO_ON_ENTRY_KEY = "workshop:lounge-audio-on-entry";

/**
 * Normalize legacy URL / storage `mode` values into the participation vocab.
 * Cameras no longer exist — a stale `mode=video` link becomes chat.
 */
export function normalizeLoungeMode(
  raw: string | null | undefined,
): LoungeParticipation {
  if (raw === "audio" || raw === "voice") return "audio";
  return "chat";
}

/**
 * Feature-detect the browser primitives Lounge live-audio needs. Returns
 * true only when both a modern WebRTC PC and mic capture APIs exist. Unsupported
 * browsers still get chat + panels; the audio strip renders a "needs a newer
 * browser" message instead of mounting the provider.
 */
export function isLoungeAudioSupported(): boolean {
  if (typeof window === "undefined") return false;
  const hasRTC =
    typeof (window as unknown as { RTCPeerConnection?: unknown })
      .RTCPeerConnection === "function";
  const hasMedia = !!(
    navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function"
  );
  const hasAudio =
    typeof (window as unknown as { AudioContext?: unknown }).AudioContext ===
      "function" ||
    typeof (window as unknown as { webkitAudioContext?: unknown })
      .webkitAudioContext === "function";
  return hasRTC && hasMedia && hasAudio;
}

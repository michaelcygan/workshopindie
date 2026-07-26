/**
 * Workshop-owned adapter surface for live Lounge audio.
 *
 * The rest of the Lounge UI consumes these types. Neither Stream nor the
 * legacy mesh peer/track shapes should leak past `use-stream-lounge-audio` /
 * `use-mesh-lounge-audio`. That keeps the transport swappable.
 */

/**
 * Where the local user currently sits in the audio state machine.
 *
 * - "connecting": SFU handshake still in flight.
 * - "listener":   connected, receiving audio only.
 * - "waiting":    in the microphone queue behind other requesters.
 * - "offered":    a mic seat is reserved; user must accept to enable it.
 * - "speaker":    publishing audio (may still be muted at the track level).
 */
export type LoungeRole =
  | "connecting"
  | "listener"
  | "waiting"
  | "offered"
  | "speaker";

/** Adapter shape for one remote (or local) participant surfaced in UI. */
export type LoungeParticipant = {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  isSpeaking: boolean;
  isDominant: boolean;
  isSelf: boolean;
  role: LoungeRole;
  muted: boolean;
  /** 0–3 style score: 0 unknown, 1 poor, 2 ok, 3 good. */
  connectionQuality: 0 | 1 | 2 | 3;
};

export type LoungeAudioError = {
  code:
    | "join_failed"
    | "token_failed"
    | "mic_denied"
    | "queue_failed"
    | "network"
    | "quota"
    | "unknown";
  message: string;
};

/**
 * The single object all Lounge UI code consumes. Both the Stream and mesh
 * hooks return exactly this shape.
 */
export type LoungeAudioApi = {
  /** SFU/mesh session is established and the local user is receiving audio. */
  connected: boolean;
  role: LoungeRole;
  /** True when the local speaker track is muted (or absent). */
  muted: boolean;
  /** In-flight action (request mic, accept offer, publish mic). */
  busy: boolean;
  error: LoungeAudioError | null;

  /** Count of published-audio participants (0..LOUNGE_SPEAKER_CAP). */
  speakerCount: number;
  /** 1-indexed position in the waiting queue, 0 if not waiting. */
  queuePosition: number;
  /** All connected participants (self included) in stage order. */
  participants: LoungeParticipant[];

  /** Browser blocked <audio> autoplay; user must resume. */
  autoplayBlocked: boolean;
  resumeAudio: () => Promise<void>;

  requestMic: () => Promise<void>;
  acceptMicOffer: () => Promise<void>;
  leaveQueue: () => Promise<void>;
  toggleMute: () => Promise<void>;
  /** Give up the mic seat. User stays connected as a listener. */
  leaveMic: () => Promise<void>;
  /** Full teardown: leave the SFU / mesh entirely. */
  disconnect: () => Promise<void>;
  /**
   * Host/admin action — mute or remove a speaker. Fails silently on the mesh
   * provider (no server-side moderation surface). UI should gate visibility
   * on caller-side role/host checks before rendering.
   */
  moderateSpeaker: (opts: { userId: string; action: "mute" | "remove" }) => Promise<void>;
  /** True when we're currently reconnecting an existing session. */
  reconnecting: boolean;

  /**
   * Available audio input devices. Empty until mic permission is granted
   * (browsers withhold labels/ids pre-permission). Optional: mesh provider
   * may return an empty list.
   */
  micDevices?: MediaDeviceInfo[];
  /** Currently selected input `deviceId`, or null for browser-default. */
  selectedMicId?: string | null;
  /** Swap the active input; persists selection per-browser. Optional. */
  selectMic?: (deviceId: string) => Promise<void>;
};


/** Provider-neutral analytics event names. */
export const LOUNGE_AUDIO_EVENTS = [
  "stream_listener_join_ok",
  "stream_listener_join_fail",
  "audio_reconnect",
  "mic_request",
  "mic_offer",
  "mic_permission_denied",
  "speaker_join",
  "speaker_leave",
  "queue_abandon",
  "connected_minutes",
] as const;
export type LoungeAudioEvent = (typeof LOUNGE_AUDIO_EVENTS)[number];

/**
 * Fire-and-forget analytics emitter.
 *
 * Writes to `public.lounge_audio_events` via an authenticated server fn.
 * De-dupes identical (event, roomId) within a short window so noisy signals
 * (speaking_start/stop-style bursts, retries) don't flood the table. Also
 * mirrors to console under a stable tag so the client trace stays intact.
 */
const _emitDedupe = new Map<string, number>();
const DEDUPE_MS = 2000;

export function emitLoungeAudioEvent(
  name: LoungeAudioEvent,
  payload: Record<string, unknown> = {},
): void {
  try {
    // eslint-disable-next-line no-console
    console.info(`[lounge-audio] ${name}`, payload);
  } catch {
    // ignore console errors
  }
  if (typeof window === "undefined") return;
  const roomId = typeof payload.roomId === "string" ? payload.roomId : null;
  const key = `${name}::${roomId ?? "-"}`;
  const now = Date.now();
  const last = _emitDedupe.get(key) ?? 0;
  if (now - last < DEDUPE_MS) return;
  _emitDedupe.set(key, now);
  // Lazy import: keeps the analytics types file free of server-fn coupling
  // and avoids a circular import through the server-fn module.
  void import("./lounge-telemetry.functions")
    .then(({ logLoungeAudioEvent }) =>
      logLoungeAudioEvent({ data: { event: name, roomId, payload } }),
    )
    .catch(() => {
      // never let analytics break the Lounge
    });
}


/** Sort: dominant/current speaker → other speakers → waiting → listeners. */
export function sortLoungeParticipants(
  participants: LoungeParticipant[],
): LoungeParticipant[] {
  const rank = (p: LoungeParticipant) => {
    if (p.isDominant) return 0;
    if (p.role === "speaker") return 1;
    if (p.role === "waiting" || p.role === "offered") return 2;
    return 3;
  };
  return [...participants].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    return (a.displayName ?? "").localeCompare(b.displayName ?? "");
  });
}

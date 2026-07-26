/**
 * Stream-provider implementation of `LoungeAudioApi`.
 *
 * Preconditions: this hook must be rendered inside `<StreamVideo>` +
 * `<StreamCall>` (both provided by `<StreamLoungeProvider>`). Outside that
 * boundary `useCall()` returns null and the API stays in the "connecting"
 * state without crashing.
 *
 * Responsibilities:
 *  - Reflect the SFU participant list into `LoungeParticipant[]`.
 *  - Own the Workshop-side speaker queue via the Postgres RPCs; on receipt
 *    of an "offered" audio_state, expose an `acceptMicOffer()` that grants
 *    Stream `send-audio` and enables the mic track.
 *  - Detect browser autoplay blocking via the SDK call state.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useCall,
  useCallStateHooks,
  type StreamVideoParticipant,
} from "@stream-io/video-react-sdk";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  emitLoungeAudioEvent,
  sortLoungeParticipants,
  type LoungeAudioApi,
  type LoungeAudioError,
  type LoungeParticipant,
  type LoungeRole,
} from "@/lib/lounge-audio-types";
import {
  grantLoungeSpeaker,
  moderateLoungeSpeaker,
  revokeLoungeSpeaker,
} from "@/lib/stream-video.functions";

/** Presence row shape (subset) — mirrors the DB columns we depend on. */
type AudioState = "chat" | "queued" | "offered" | "speaker";
type PresenceRow = {
  user_id: string;
  audio_state: AudioState;
  queued_at: string | null;
};

function stateToRole(state: AudioState, connected: boolean): LoungeRole {
  if (!connected) return "connecting";
  switch (state) {
    case "speaker":
      return "speaker";
    case "offered":
      // Host-less queue: treat any lingering "offered" row as waiting.
      return "waiting";
    case "queued":
      return "waiting";
    default:
      return "listener";
  }
}

export function useStreamLoungeAudio(
  roomId: string,
  opts: { participation: "chat" | "audio" },
): LoungeAudioApi {
  const { user } = useAuth();
  const call = useCall();
  const { useParticipants, useDominantSpeaker, useCallCallingState } =
    useCallStateHooks();
  const sdkParticipants = useParticipants();
  const dominantSpeaker = useDominantSpeaker();
  const callingState = useCallCallingState();

  const [presence, setPresence] = useState<Map<string, PresenceRow>>(new Map());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LoungeAudioError | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [muted, setMuted] = useState(true);

  const connected = callingState === "joined";
  const reconnecting =
    callingState === "reconnecting" ||
    callingState === "reconnecting-failed" ||
    callingState === "offline";

  // Emit audio_reconnect telemetry on transport transitions.
  const lastConnStateRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = lastConnStateRef.current;
    lastConnStateRef.current = callingState;
    if (prev && prev !== callingState && callingState === "reconnecting") {
      emitLoungeAudioEvent("audio_reconnect", { roomId, from: prev });
    }
  }, [callingState, roomId]);

  // Connected-minutes rollup — reserve one minute against the Free monthly
  // cap on each tick. The RPC also writes the telemetry row on success;
  // Plus/trial subscribers are `monthlyLimit: null` and never blocked.
  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const { reserveLoungeMinute } = await import(
          "@/lib/lounge-access.functions"
        );
        const res = await reserveLoungeMinute({ data: { roomId } });
        if (cancelled) return;
        if (!res.ok) {
          setError({ code: "quota", message: res.reason ?? "Monthly Lounge audio limit reached." });
          try {
            await call?.leave();
          } catch {
            // ignore
          }
        }
      } catch {
        // Fail-open: never break the audio path on telemetry errors.
      }
    };
    const iv = window.setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(iv);
    };
  }, [connected, roomId, call]);

  // Load + subscribe to presence audio_state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("instant_presence")
        .select("user_id, audio_state, queued_at")
        .eq("room_id", roomId);
      if (cancelled || !data) return;
      const m = new Map<string, PresenceRow>();
      for (const row of data as unknown as PresenceRow[]) m.set(row.user_id, row);
      setPresence(m);
    })();

    const channel = supabase
      .channel(`lounge-audio-${roomId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "instant_presence",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          setPresence((prev) => {
            const next = new Map(prev);
            const row =
              (payload.new as PresenceRow | null) ??
              (payload.old as PresenceRow | null);
            if (!row) return prev;
            if (payload.eventType === "DELETE") next.delete(row.user_id);
            else next.set(row.user_id, payload.new as PresenceRow);
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // Derive my audio_state; default to "chat" until presence lands.
  const myState: AudioState = user
    ? (presence.get(user.id)?.audio_state ?? "chat")
    : "chat";

  // Host-less auto-claim: when connected with audio participation, request
  // the mic once. The DB fast-paths to `speaker` if a stage seat is open,
  // else lands us in `waiting` and auto-promotes when a seat frees up.
  const autoRequestedRef = useRef(false);
  useEffect(() => {
    if (opts.participation !== "audio") return;
    if (!connected || !user) {
      autoRequestedRef.current = false;
      return;
    }
    if (autoRequestedRef.current) return;
    // Only auto-request if we're currently a chat listener; don't clobber
    // an existing speaker/waiting row (e.g. after reconnect).
    if (myState !== "chat") {
      autoRequestedRef.current = true;
      return;
    }
    autoRequestedRef.current = true;
    (async () => {
      try {
        emitLoungeAudioEvent("mic_request", { roomId, auto: true });
        await supabase.rpc("request_lounge_audio_slot", { _room_id: roomId });
      } catch {
        // Allow a retry on next presence tick.
        autoRequestedRef.current = false;
      }
    })();
  }, [opts.participation, connected, user, roomId, myState]);

  // Auto-accept path: when the DB flips me to "speaker" (either directly via
  // request_lounge_audio_slot fast-path, or after accepting an offer), publish
  // audio. When it flips away, revoke.
  const publishedRef = useRef(false);
  useEffect(() => {
    if (!call || !user) return;
    let cancelled = false;
    (async () => {
      if (myState === "speaker" && !publishedRef.current) {
        try {
          await grantLoungeSpeaker({ data: { roomId } });
          if (cancelled) return;
          await call.microphone.enable();
          publishedRef.current = true;
          setMuted(false);
          emitLoungeAudioEvent("speaker_join", { roomId });
        } catch (e) {
          if (cancelled) return;
          const msg = e instanceof Error ? e.message : "Mic unavailable";
          if (/permission|denied|NotAllowedError/i.test(msg)) {
            setError({ code: "mic_denied", message: msg });
            emitLoungeAudioEvent("mic_permission_denied", { roomId });
          } else {
            setError({ code: "unknown", message: msg });
          }
          try {
            await supabase.rpc("release_lounge_audio_slot", { _room_id: roomId });
          } catch { /* noop */ }
        }
      } else if (myState !== "speaker" && publishedRef.current) {
        try { await call.microphone.disable(); } catch { /* noop */ }
        publishedRef.current = false;
        setMuted(true);
      }
    })();
    return () => { cancelled = true; };
  }, [myState, call, user, roomId]);

  // Autoplay detection — the SDK exposes this via participant audio elements,
  // but a simple heuristic: if we're connected and there are speakers but no
  // audio has been resumed, flag it. Kept conservative to avoid false positives.
  useEffect(() => {
    if (!connected) setAutoplayBlocked(false);
  }, [connected]);

  const participants = useMemo<LoungeParticipant[]>(() => {
    // Merge SDK participants (source of truth for speaking / mute) with
    // presence rows (source of truth for role / queue). Presence-only rows
    // (chat-only participants who haven't joined the SFU) are omitted here —
    // the surrounding "Here now" list handles them.
    const bySdkId = new Map<string, StreamVideoParticipant>();
    for (const p of sdkParticipants) bySdkId.set(p.userId, p);

    const list: LoungeParticipant[] = [];
    for (const [uid, sdk] of bySdkId.entries()) {
      const row = presence.get(uid);
      const state = row?.audio_state ?? "chat";
      list.push({
        userId: uid,
        displayName: sdk.name ?? null,
        avatarUrl: sdk.image ?? null,
        isSpeaking: !!sdk.isSpeaking,
        isDominant: dominantSpeaker?.userId === uid,
        isSelf: uid === user?.id,
        role: stateToRole(state, true),
        muted: !sdk.publishedTracks?.length,
        connectionQuality: (sdk.connectionQuality ?? 2) as 0 | 1 | 2 | 3,
      });
    }
    // Include presence-only rows that are queued/offered (they may not be in
    // the SFU yet but still deserve a "waiting" affordance).
    for (const row of presence.values()) {
      if (bySdkId.has(row.user_id)) continue;
      if (row.audio_state === "queued" || row.audio_state === "offered") {
        list.push({
          userId: row.user_id,
          displayName: null,
          avatarUrl: null,
          isSpeaking: false,
          isDominant: false,
          isSelf: row.user_id === user?.id,
          role: stateToRole(row.audio_state, true),
          muted: true,
          connectionQuality: 0,
        });
      }
    }
    return sortLoungeParticipants(list);
  }, [sdkParticipants, presence, dominantSpeaker, user?.id]);

  const speakerCount = useMemo(
    () => Array.from(presence.values()).filter((r) => r.audio_state === "speaker").length,
    [presence],
  );

  const queuePosition = useMemo(() => {
    if (!user || myState !== "queued") return 0;
    const queued = Array.from(presence.values())
      .filter((r) => r.audio_state === "queued")
      .sort((a, b) => (a.queued_at ?? "").localeCompare(b.queued_at ?? ""));
    const idx = queued.findIndex((r) => r.user_id === user.id);
    return idx < 0 ? 0 : idx + 1;
  }, [presence, user, myState]);

  const requestMic = useCallback(async () => {
    if (opts.participation !== "audio") return;
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      emitLoungeAudioEvent("mic_request", { roomId });
      const { error: e } = await supabase.rpc("request_lounge_audio_slot", {
        _room_id: roomId,
      });
      if (e) throw e;
    } catch (e) {
      setError({
        code: "queue_failed",
        message: e instanceof Error ? e.message : "Couldn't request mic",
      });
    } finally {
      setBusy(false);
    }
  }, [opts.participation, user, busy, roomId]);

  const acceptMicOffer = useCallback(async () => {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      emitLoungeAudioEvent("mic_offer", { roomId, action: "accept" });
      const { error: e } = await supabase.rpc("accept_lounge_audio_offer", {
        _room_id: roomId,
      });
      if (e) throw e;
      // The audio_state → speaker flip triggers the publish effect above.
    } catch (e) {
      setError({
        code: "queue_failed",
        message: e instanceof Error ? e.message : "Couldn't accept",
      });
    } finally {
      setBusy(false);
    }
  }, [user, busy, roomId]);

  const leaveQueue = useCallback(async () => {
    if (!user) return;
    try {
      emitLoungeAudioEvent("queue_abandon", { roomId });
      await supabase.rpc("leave_lounge_audio_queue", { _room_id: roomId });
    } catch { /* noop */ }
  }, [user, roomId]);

  const toggleMute = useCallback(async () => {
    if (!call) return;
    try {
      if (muted) {
        await call.microphone.enable();
        setMuted(false);
      } else {
        await call.microphone.disable();
        setMuted(true);
      }
    } catch { /* noop */ }
  }, [call, muted]);

  const leaveMic = useCallback(async () => {
    if (!user) return;
    try {
      await call?.microphone.disable();
      publishedRef.current = false;
      setMuted(true);
      await supabase.rpc("release_lounge_audio_slot", { _room_id: roomId });
      await revokeLoungeSpeaker({ data: { roomId } });
      emitLoungeAudioEvent("speaker_leave", { roomId });
    } catch { /* noop */ }
  }, [call, user, roomId]);

  const disconnect = useCallback(async () => {
    try {
      if (publishedRef.current) await leaveMic();
      await call?.leave();
    } catch { /* noop */ }
  }, [call, leaveMic]);

  const resumeAudio = useCallback(async () => {
    // The Stream SDK auto-resumes audio elements when user interacts;
    // we merely clear the flag so the banner disappears.
    setAutoplayBlocked(false);
  }, []);

  const moderateSpeaker = useCallback(
    async (opts: { userId: string; action: "mute" | "remove" }) => {
      try {
        await moderateLoungeSpeaker({
          data: { roomId, targetUserId: opts.userId, action: opts.action },
        });
      } catch (e) {
        setError({
          code: "unknown",
          message: e instanceof Error ? e.message : "Moderator action failed",
        });
      }
    },
    [roomId],
  );

  return {
    connected,
    role: stateToRole(myState, connected),
    muted,
    busy,
    error,
    speakerCount,
    queuePosition,
    participants,
    autoplayBlocked,
    resumeAudio,
    requestMic,
    acceptMicOffer,
    leaveQueue,
    toggleMute,
    leaveMic,
    disconnect,
    moderateSpeaker,
    reconnecting,
  };
}

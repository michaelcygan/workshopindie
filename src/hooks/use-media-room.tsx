import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ],
};

export const ROOM_CAP = 8;
export const VIDEO_CAP = 4;

export type MediaMode = "listening" | "voice" | "video";

export type MediaPeer = {
  userId: string;
  speaking: boolean;
  mode: MediaMode;
  stream: MediaStream | null;
};

type SignalEvent =
  | { type: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; from: string; to: string; candidate: RTCIceCandidateInit }
  | { type: "speaking"; from: string; speaking: boolean };

type PresenceMeta = { mode: MediaMode; joined_at: string };

export function useMediaRoom(roomId: string | undefined) {
  const { user } = useAuth();
  const myId = user?.id;

  const [joined, setJoined] = useState(false);
  const [mode, setModeState] = useState<MediaMode>("listening");
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [count, setCount] = useState(0); // total presence including listeners
  const [voiceCount, setVoiceCount] = useState(0); // voice + video
  const [videoCount, setVideoCount] = useState(0);
  const [peers, setPeers] = useState<Record<string, MediaPeer>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const speakingStopRef = useRef<(() => void) | null>(null);
  const lastSpeakingSentRef = useRef<boolean>(false);
  const modeRef = useRef<MediaMode>("listening");

  // ---- helpers ---------------------------------------------------------------

  function attachStream(peerId: string, stream: MediaStream) {
    setPeers((prev) => ({
      ...prev,
      [peerId]: { ...(prev[peerId] ?? { userId: peerId, speaking: false, mode: "voice" }), stream },
    }));
  }

  function closePeer(peerId: string) {
    const pc = pcsRef.current.get(peerId);
    if (pc) {
      try { pc.close(); } catch { /* noop */ }
      pcsRef.current.delete(peerId);
    }
    setPeers((prev) => {
      if (!(peerId in prev)) return prev;
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  }

  function ensurePeer(peerId: string, peerMode: MediaMode = "voice"): RTCPeerConnection {
    const existing = pcsRef.current.get(peerId);
    if (existing) return existing;
    const pc = new RTCPeerConnection(ICE_CONFIG);
    pcsRef.current.set(peerId, pc);
    setPeers((prev) => ({
      ...prev,
      [peerId]: { userId: peerId, speaking: false, mode: peerMode, stream: prev[peerId]?.stream ?? null },
    }));

    const local = localStreamRef.current;
    if (local) for (const t of local.getTracks()) pc.addTrack(t, local);

    pc.ontrack = (ev) => {
      const [stream] = ev.streams;
      if (stream) attachStream(peerId, stream);
    };
    pc.onicecandidate = (ev) => {
      if (ev.candidate && myId && channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "signal",
          payload: { type: "ice", from: myId, to: peerId, candidate: ev.candidate.toJSON() } satisfies SignalEvent,
        });
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") closePeer(peerId);
    };
    return pc;
  }

  async function makeOffer(peerId: string) {
    const pc = ensurePeer(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    if (myId && channelRef.current && pc.localDescription) {
      channelRef.current.send({
        type: "broadcast",
        event: "signal",
        payload: { type: "offer", from: myId, to: peerId, sdp: pc.localDescription.toJSON() } satisfies SignalEvent,
      });
    }
  }

  async function handleSignal(ev: SignalEvent) {
    if (!myId) return;
    if ("to" in ev && ev.to !== myId) return;
    if (ev.from === myId) return;

    if (ev.type === "offer") {
      const pc = ensurePeer(ev.from);
      await pc.setRemoteDescription(new RTCSessionDescription(ev.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      if (channelRef.current && pc.localDescription) {
        channelRef.current.send({
          type: "broadcast",
          event: "signal",
          payload: { type: "answer", from: myId, to: ev.from, sdp: pc.localDescription.toJSON() } satisfies SignalEvent,
        });
      }
    } else if (ev.type === "answer") {
      const pc = pcsRef.current.get(ev.from);
      if (pc && pc.signalingState !== "stable") {
        await pc.setRemoteDescription(new RTCSessionDescription(ev.sdp));
      }
    } else if (ev.type === "ice") {
      const pc = pcsRef.current.get(ev.from);
      if (pc) {
        try { await pc.addIceCandidate(new RTCIceCandidate(ev.candidate)); } catch { /* noop */ }
      }
    } else if (ev.type === "speaking") {
      setPeers((prev) => {
        const cur = prev[ev.from];
        if (!cur || cur.speaking === ev.speaking) return prev;
        return { ...prev, [ev.from]: { ...cur, speaking: ev.speaking } };
      });
    }
  }

  // ---- speaking detector -----------------------------------------------------

  function startSpeakingDetector(stream: MediaStream) {
    const AudioCtx: typeof AudioContext =
      (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const ctx = new AudioCtx();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    let lastChange = 0;
    let active = false;

    const loop = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      const isSpeaking = rms > 0.045;
      const now = performance.now();
      if (isSpeaking !== active && now - lastChange > 200) {
        active = isSpeaking;
        lastChange = now;
        setSpeaking(active);
        if (channelRef.current && myId && lastSpeakingSentRef.current !== active) {
          lastSpeakingSentRef.current = active;
          channelRef.current.send({
            type: "broadcast",
            event: "signal",
            payload: { type: "speaking", from: myId, speaking: active } satisfies SignalEvent,
          });
        }
      }
      raf = requestAnimationFrame(loop);
    };
    loop();

    speakingStopRef.current = () => {
      cancelAnimationFrame(raf);
      try { src.disconnect(); } catch { /* noop */ }
      ctx.close().catch(() => {});
      speakingStopRef.current = null;
    };
  }

  // ---- always-on count subscription -----------------------------------------
  // Lurker channel watches presence to show counts before joining.
  // CRITICAL: register .on() handlers BEFORE .subscribe() to avoid the
  // "cannot add presence callbacks after subscribe()" error.

  useEffect(() => {
    if (!roomId) return;
    const ch = supabase.channel(`media:${roomId}`, {
      config: { presence: { key: "lurker" }, broadcast: { self: false } },
    });

    function recompute() {
      const state = ch.presenceState() as Record<string, Array<PresenceMeta>>;
      const entries = Object.entries(state).filter(([k]) => k !== "lurker");
      setCount(entries.length);
      let v = 0, vid = 0;
      for (const [, metas] of entries) {
        const m = metas[0]?.mode ?? "voice";
        if (m === "voice" || m === "video") v++;
        if (m === "video") vid++;
      }
      setVoiceCount(v);
      setVideoCount(vid);
    }

    ch.on("presence", { event: "sync" }, recompute).subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [roomId]);

  // ---- internal: tear down media + peers without unsubscribing channel ------

  function teardownMedia() {
    for (const peerId of Array.from(pcsRef.current.keys())) closePeer(peerId);
    if (localStreamRef.current) {
      for (const t of localStreamRef.current.getTracks()) t.stop();
      localStreamRef.current = null;
    }
    if (speakingStopRef.current) speakingStopRef.current();
    setSpeaking(false);
    setMuted(false);
    lastSpeakingSentRef.current = false;
  }

  // ---- leave ----------------------------------------------------------------

  const leave = useCallback(() => {
    teardownMedia();
    if (channelRef.current) {
      const ch = channelRef.current;
      ch.untrack().catch(() => {});
      supabase.removeChannel(ch);
      channelRef.current = null;
    }
    setJoined(false);
    setPeers({});
    setModeState("listening");
    modeRef.current = "listening";
  }, []);

  // ---- join with a mode -----------------------------------------------------

  const joinWithMode = useCallback(async (nextMode: MediaMode) => {
    if (!myId || !roomId) return;
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      // Cap checks
      if (count >= ROOM_CAP && !joined) {
        setError(`Room is full (${ROOM_CAP} max).`);
        setBusy(false);
        return;
      }
      let effectiveMode = nextMode;
      if (effectiveMode === "video" && videoCount >= VIDEO_CAP) {
        effectiveMode = "voice";
        setError(`Video full (${VIDEO_CAP} cams). Joined as voice.`);
      }

      // If already joined, tear down media first (we're switching modes).
      if (joined) {
        teardownMedia();
      }

      // Get media for the chosen mode.
      let stream: MediaStream | null = null;
      if (effectiveMode === "voice" || effectiveMode === "video") {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: effectiveMode === "video"
              ? { width: { ideal: 480 }, height: { ideal: 360 }, frameRate: { ideal: 24 } }
              : false,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Mic blocked";
          setError(`Couldn't access ${effectiveMode === "video" ? "camera/mic" : "mic"}: ${msg}`);
          setBusy(false);
          return;
        }
        localStreamRef.current = stream;
      }

      modeRef.current = effectiveMode;
      setModeState(effectiveMode);

      // Set up signaling channel if not already.
      let ch = channelRef.current;
      const firstJoin = !ch;
      if (!ch) {
        ch = supabase.channel(`media:${roomId}`, {
          config: { presence: { key: myId }, broadcast: { self: false } },
        });
        channelRef.current = ch;

        // Register all handlers BEFORE subscribe.
        ch.on("presence", { event: "sync" }, () => {
          const state = ch!.presenceState() as Record<string, Array<PresenceMeta>>;
          const ids = Object.keys(state).filter((k) => k !== "lurker" && k !== myId);
          // Recompute counts
          const allEntries = Object.entries(state).filter(([k]) => k !== "lurker");
          setCount(allEntries.length);
          let v = 0, vid = 0;
          for (const [, metas] of allEntries) {
            const m = metas[0]?.mode ?? "voice";
            if (m === "voice" || m === "video") v++;
            if (m === "video") vid++;
          }
          setVoiceCount(v);
          setVideoCount(vid);
          // Update peer modes
          setPeers((prev) => {
            const next = { ...prev };
            for (const [pid, metas] of allEntries) {
              if (pid === myId) continue;
              const pmode = (metas[0]?.mode ?? "voice") as MediaMode;
              if (next[pid]) next[pid] = { ...next[pid], mode: pmode };
            }
            return next;
          });
          // Drop peers no longer present (or who switched to listening)
          for (const peerId of Array.from(pcsRef.current.keys())) {
            const peerMeta = state[peerId]?.[0];
            if (!ids.includes(peerId) || !peerMeta || peerMeta.mode === "listening") {
              closePeer(peerId);
            }
          }
        });

        ch.on("presence", { event: "join" }, ({ key, newPresences }) => {
          if (key === "lurker" || key === myId) return;
          const peerMode = ((newPresences[0] as PresenceMeta | undefined)?.mode ?? "voice") as MediaMode;
          if (peerMode === "listening") return;
          if (modeRef.current === "listening") return;
          if (myId > key) {
            setTimeout(() => { makeOffer(key).catch(() => {}); }, 250);
          } else {
            ensurePeer(key, peerMode);
          }
        });

        ch.on("presence", { event: "leave" }, ({ key }) => {
          if (key === "lurker" || key === myId) return;
          closePeer(key);
        });

        ch.on("broadcast", { event: "signal" }, ({ payload }) => {
          handleSignal(payload as SignalEvent).catch(() => {});
        });

        await new Promise<void>((resolve, reject) => {
          ch!.subscribe(async (status) => {
            if (status === "SUBSCRIBED") {
              await ch!.track({ mode: effectiveMode, joined_at: new Date().toISOString() } satisfies PresenceMeta);
              resolve();
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              reject(new Error("Couldn't connect to media channel"));
            }
          });
        });
      } else {
        // Already subscribed — just update our presence mode.
        await ch.track({ mode: effectiveMode, joined_at: new Date().toISOString() } satisfies PresenceMeta);
      }

      // If not listening, build mesh against current media participants.
      if (effectiveMode !== "listening") {
        const state = ch.presenceState() as Record<string, Array<PresenceMeta>>;
        const others = Object.entries(state).filter(
          ([k, metas]) => k !== "lurker" && k !== myId && metas[0]?.mode !== "listening",
        );
        for (const [peerId, metas] of others) {
          const peerMode = (metas[0]?.mode ?? "voice") as MediaMode;
          if (myId > peerId) {
            setTimeout(() => { makeOffer(peerId).catch(() => {}); }, firstJoin ? 250 : 100);
          } else {
            ensurePeer(peerId, peerMode);
          }
        }
        if (stream && stream.getAudioTracks().length > 0) startSpeakingDetector(stream);
      }

      setJoined(true);
      setBusy(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't join";
      setError(msg);
      leave();
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId, roomId, busy, joined, count, videoCount, leave]);

  const setMode = useCallback((m: MediaMode) => { joinWithMode(m); }, [joinWithMode]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !muted;
    for (const t of stream.getAudioTracks()) t.enabled = !next;
    setMuted(next);
    if (next && lastSpeakingSentRef.current) {
      lastSpeakingSentRef.current = false;
      setSpeaking(false);
      if (channelRef.current && myId) {
        channelRef.current.send({
          type: "broadcast",
          event: "signal",
          payload: { type: "speaking", from: myId, speaking: false } satisfies SignalEvent,
        });
      }
    }
  }, [muted, myId]);

  // Cleanup
  useEffect(() => {
    return () => { leave(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    function onUnload() { leave(); }
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [leave]);

  return {
    joined,
    mode,
    muted,
    speaking,
    count,
    voiceCount,
    videoCount,
    peers: Object.values(peers),
    localStream: localStreamRef.current,
    error,
    busy,
    setMode,
    leave,
    toggleMute,
    cap: ROOM_CAP,
    videoCap: VIDEO_CAP,
  };
}

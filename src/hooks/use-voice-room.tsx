import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ],
};

export const VOICE_CAP = 8;

export type VoicePeer = { userId: string; speaking: boolean };

type SignalEvent =
  | { type: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; from: string; to: string; candidate: RTCIceCandidateInit }
  | { type: "speaking"; from: string; speaking: boolean };

export function useVoiceRoom(roomId: string | undefined) {
  const { user } = useAuth();
  const myId = user?.id;

  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [count, setCount] = useState(0); // total in voice (incl. me)
  const [peers, setPeers] = useState<Record<string, VoicePeer>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audiosRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const speakingStopRef = useRef<(() => void) | null>(null);
  const lastSpeakingSentRef = useRef<boolean>(false);

  // ---- helpers ---------------------------------------------------------------

  function attachRemoteStream(peerId: string, stream: MediaStream) {
    let el = audiosRef.current.get(peerId);
    if (!el) {
      el = document.createElement("audio");
      el.autoplay = true;
      el.setAttribute("playsinline", "true");
      el.dataset.voicePeer = peerId;
      document.body.appendChild(el);
      audiosRef.current.set(peerId, el);
    }
    el.srcObject = stream;
    el.play().catch(() => {});
  }

  function detachRemoteStream(peerId: string) {
    const el = audiosRef.current.get(peerId);
    if (el) {
      el.srcObject = null;
      el.remove();
      audiosRef.current.delete(peerId);
    }
  }

  function closePeer(peerId: string) {
    const pc = pcsRef.current.get(peerId);
    if (pc) {
      try { pc.close(); } catch { /* noop */ }
      pcsRef.current.delete(peerId);
    }
    detachRemoteStream(peerId);
    setPeers((prev) => {
      if (!(peerId in prev)) return prev;
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  }

  function ensurePeer(peerId: string): RTCPeerConnection {
    const existing = pcsRef.current.get(peerId);
    if (existing) return existing;
    const pc = new RTCPeerConnection(ICE_CONFIG);
    pcsRef.current.set(peerId, pc);
    setPeers((prev) => ({ ...prev, [peerId]: { userId: peerId, speaking: false } }));

    // Add local tracks
    const local = localStreamRef.current;
    if (local) {
      for (const t of local.getTracks()) pc.addTrack(t, local);
    }

    pc.ontrack = (ev) => {
      const [stream] = ev.streams;
      if (stream) attachRemoteStream(peerId, stream);
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
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
        // Let presence drive removal in normal cases; close the PC if it failed.
        if (pc.connectionState === "failed") closePeer(peerId);
      }
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
        if (!cur) return prev;
        if (cur.speaking === ev.speaking) return prev;
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
      // Debounce: only flip state if stable for 200ms
      if (isSpeaking !== active && now - lastChange > 200) {
        active = isSpeaking;
        lastChange = now;
        setSpeaking(active);
        // Broadcast change to peers
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

  useEffect(() => {
    if (!roomId) return;
    const ch = supabase.channel(`voice:${roomId}`, {
      config: { presence: { key: "lurker" }, broadcast: { self: false } },
    });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();
      // Each tracked user gets a key === their userId; lurkers don't track.
      const ids = Object.keys(state).filter((k) => k !== "lurker");
      setCount(ids.length);
    }).subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [roomId]);

  // ---- join / leave ----------------------------------------------------------

  const leave = useCallback(() => {
    // Close all peers
    for (const peerId of Array.from(pcsRef.current.keys())) closePeer(peerId);
    // Stop local tracks
    if (localStreamRef.current) {
      for (const t of localStreamRef.current.getTracks()) t.stop();
      localStreamRef.current = null;
    }
    // Stop detector
    if (speakingStopRef.current) speakingStopRef.current();
    // Untrack + unsubscribe channel
    if (channelRef.current) {
      const ch = channelRef.current;
      ch.untrack().catch(() => {});
      supabase.removeChannel(ch);
      channelRef.current = null;
    }
    setJoined(false);
    setSpeaking(false);
    setMuted(false);
    setPeers({});
    lastSpeakingSentRef.current = false;
  }, []);

  const join = useCallback(async () => {
    if (!myId || !roomId || busy || joined) return;
    setError(null);
    setBusy(true);
    try {
      // Cap check via presence count
      if (count >= VOICE_CAP) {
        setError(`Voice is full (${VOICE_CAP} max). Try again in a minute.`);
        setBusy(false);
        return;
      }

      // 1. Get mic
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Mic blocked";
        setError(`Couldn't access mic: ${msg}`);
        setBusy(false);
        return;
      }
      localStreamRef.current = stream;

      // 2. Subscribe to signaling channel
      const ch = supabase.channel(`voice:${roomId}`, {
        config: { presence: { key: myId }, broadcast: { self: false } },
      });
      channelRef.current = ch;

      ch.on("presence", { event: "sync" }, () => {
        const state = ch.presenceState();
        const ids = Object.keys(state).filter((k) => k !== "lurker" && k !== myId);
        setCount(Object.keys(state).filter((k) => k !== "lurker").length);
        // Drop peers that left
        for (const peerId of Array.from(pcsRef.current.keys())) {
          if (!ids.includes(peerId)) closePeer(peerId);
        }
      });

      ch.on("presence", { event: "join" }, ({ key }) => {
        if (key === "lurker" || key === myId) return;
        // Deterministic initiator: the higher userId initiates the offer.
        if (myId > key) {
          // Wait a tick so the new peer has set up its handlers.
          setTimeout(() => { makeOffer(key).catch(() => {}); }, 250);
        } else {
          ensurePeer(key);
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
        ch.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await ch.track({ joined_at: new Date().toISOString() });
            resolve();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            reject(new Error("Couldn't connect to voice channel"));
          }
        });
      });

      // 3. Initiate offers to existing peers (those whose id < mine).
      const state = ch.presenceState();
      const existing = Object.keys(state).filter((k) => k !== "lurker" && k !== myId);
      for (const peerId of existing) {
        if (myId > peerId) {
          // I'm the initiator — fire the offer.
          setTimeout(() => { makeOffer(peerId).catch(() => {}); }, 250);
        } else {
          ensurePeer(peerId);
        }
      }

      // 4. Speaking detector
      startSpeakingDetector(stream);

      setJoined(true);
      setBusy(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't join voice";
      setError(msg);
      leave();
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId, roomId, busy, joined, count, leave]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !muted;
    for (const t of stream.getAudioTracks()) t.enabled = !next;
    setMuted(next);
    if (next && lastSpeakingSentRef.current) {
      // Force-clear speaking state when muted
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

  // ---- cleanup on unmount / room change --------------------------------------

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
    muted,
    speaking,
    count,
    peers: Object.values(peers),
    error,
    busy,
    join,
    leave,
    toggleMute,
    cap: VOICE_CAP,
  };
}

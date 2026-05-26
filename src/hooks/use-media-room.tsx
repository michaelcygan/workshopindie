import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { mintTurnCreds } from "@/lib/turn.functions";

const STUN_ONLY: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

const ICE_CONFIG: RTCConfiguration = { iceServers: STUN_ONLY };

// How long to wait for ICE to reach "connected" before assuming the direct
// peer-to-peer path won't work and upgrading this pair to TURN relay.
const ICE_CHECKING_TIMEOUT_MS = 8000;

export const ROOM_CAP = 5;
export const VIDEO_CAP = 5;

export type MediaMode = "voice" | "video";

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
  const [mode, setModeState] = useState<MediaMode>("voice");
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOnState] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [count, setCount] = useState(0);
  const [voiceCount, setVoiceCount] = useState(0);
  const [videoCount, setVideoCount] = useState(0);
  const [peers, setPeers] = useState<Record<string, MediaPeer>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const speakingStopRef = useRef<(() => void) | null>(null);
  const lastSpeakingSentRef = useRef<boolean>(false);
  const modeRef = useRef<MediaMode>("voice");

  // ---- TURN fallback (session-cached) ---------------------------------------
  // STUN-only is tried first for every pair (free). We only fetch TURN
  // credentials when at least one pair has actually failed to connect.
  const turnIceServersRef = useRef<RTCIceServer[] | null>(null);
  const turnFetchPromiseRef = useRef<Promise<RTCIceServer[]> | null>(null);
  const turnExpiresAtRef = useRef<number>(0);
  const pairUsedTurnRef = useRef<Set<string>>(new Set());
  const pairCheckTimersRef = useRef<Map<string, number>>(new Map());

  async function getTurnIceServers(): Promise<RTCIceServer[]> {
    const now = Date.now();
    if (turnIceServersRef.current && turnExpiresAtRef.current > now + 30_000) {
      return turnIceServersRef.current;
    }
    if (turnFetchPromiseRef.current) return turnFetchPromiseRef.current;

    turnFetchPromiseRef.current = (async () => {
      const res = await mintTurnCreds({ data: { roomId, ttlSeconds: 600 } });
      turnIceServersRef.current = res.iceServers;
      turnExpiresAtRef.current = new Date(res.expiresAt).getTime();
      return res.iceServers;
    })();

    try {
      return await turnFetchPromiseRef.current;
    } finally {
      turnFetchPromiseRef.current = null;
    }
  }

  function attachStream(peerId: string, stream: MediaStream) {
    setPeers((prev) => ({
      ...prev,
      [peerId]: { ...(prev[peerId] ?? { userId: peerId, speaking: false, mode: "voice" }), stream },
    }));
  }

  function closePeer(peerId: string) {
    const t = pairCheckTimersRef.current.get(peerId);
    if (t) { clearTimeout(t); pairCheckTimersRef.current.delete(peerId); }
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

  function clearCheckTimer(peerId: string) {
    const t = pairCheckTimersRef.current.get(peerId);
    if (t) {
      clearTimeout(t);
      pairCheckTimersRef.current.delete(peerId);
    }
  }

  async function upgradePeerToTurn(peerId: string, peerMode: MediaMode) {
    if (pairUsedTurnRef.current.has(peerId)) return; // one retry per pair
    pairUsedTurnRef.current.add(peerId);
    clearCheckTimer(peerId);

    let turnServers: RTCIceServer[];
    try {
      turnServers = await getTurnIceServers();
    } catch (e) {
      console.warn("TURN mint failed", e);
      closePeer(peerId);
      return;
    }

    // Tear down the failed pc and recreate with TURN servers.
    closePeer(peerId);
    const pc = createPeer(peerId, peerMode, [...STUN_ONLY, ...turnServers]);
    // Only the lex-greater side re-offers (matches normal join handshake).
    if (myId && myId > peerId) {
      try { await makeOfferOn(pc, peerId); } catch (e) { console.warn("TURN re-offer failed", e); }
    }
  }

  function createPeer(
    peerId: string,
    peerMode: MediaMode,
    iceServers: RTCIceServer[] = STUN_ONLY,
  ): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers });
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
    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      if (s === "connected" || s === "completed") {
        clearCheckTimer(peerId);
      } else if (s === "checking") {
        // Arm 8s upgrade timer (only once per pair lifecycle).
        if (!pairCheckTimersRef.current.has(peerId) && !pairUsedTurnRef.current.has(peerId)) {
          const t = window.setTimeout(() => {
            pairCheckTimersRef.current.delete(peerId);
            if (pcsRef.current.get(peerId) === pc &&
                (pc.iceConnectionState === "checking" || pc.iceConnectionState === "new")) {
              upgradePeerToTurn(peerId, peerMode);
            }
          }, ICE_CHECKING_TIMEOUT_MS);
          pairCheckTimersRef.current.set(peerId, t);
        }
      } else if (s === "failed" || s === "disconnected") {
        if (!pairUsedTurnRef.current.has(peerId)) {
          upgradePeerToTurn(peerId, peerMode);
        } else if (s === "failed") {
          closePeer(peerId);
        }
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" && pairUsedTurnRef.current.has(peerId)) {
        closePeer(peerId);
      }
    };
    return pc;
  }

  function ensurePeer(peerId: string, peerMode: MediaMode = "voice"): RTCPeerConnection {
    const existing = pcsRef.current.get(peerId);
    if (existing) return existing;
    return createPeer(peerId, peerMode, STUN_ONLY);
  }

  async function makeOfferOn(pc: RTCPeerConnection, peerId: string) {
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

  async function makeOffer(peerId: string) {
    const pc = ensurePeer(peerId);
    await makeOfferOn(pc, peerId);
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

  // ---- always-on lurker count subscription ----------------------------------
  // CRITICAL: must use a DIFFERENT channel name than the join channel to avoid
  // Supabase Realtime returning the already-subscribed instance.
  useEffect(() => {
    if (!roomId) return;
    const ch = supabase.channel(`media-lurker:${roomId}`, {
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

  function teardownMedia() {
    for (const peerId of Array.from(pcsRef.current.keys())) closePeer(peerId);
    for (const t of pairCheckTimersRef.current.values()) clearTimeout(t);
    pairCheckTimersRef.current.clear();
    pairUsedTurnRef.current.clear();
    turnIceServersRef.current = null;
    turnExpiresAtRef.current = 0;
    if (localStreamRef.current) {
      for (const t of localStreamRef.current.getTracks()) t.stop();
      localStreamRef.current = null;
    }
    if (speakingStopRef.current) speakingStopRef.current();
    setSpeaking(false);
    setMuted(false);
    setCameraOnState(false);
    lastSpeakingSentRef.current = false;
  }
    teardownMedia();
    const ch = channelRef.current;
    channelRef.current = null;
    if (ch) {
      ch.untrack().catch(() => {});
      supabase.removeChannel(ch);
    }
    setJoined(false);
    setPeers({});
    setError(null);
    setModeState("voice");
    modeRef.current = "voice";
  }, []);

  const joinWithMode = useCallback(async (nextMode: MediaMode) => {
    if (!myId || !roomId) return;
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      if (count >= ROOM_CAP && !joined) {
        setError(`Room is full (${ROOM_CAP} max).`);
        setBusy(false);
        return;
      }
      let effectiveMode = nextMode;
      if (effectiveMode === "video" && videoCount >= VIDEO_CAP && !joined) {
        effectiveMode = "voice";
        setError(`Video full (${VIDEO_CAP} cams). Joined as voice.`);
      }

      if (joined) teardownMedia();

      let stream: MediaStream | null = null;
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
      setCameraOnState(effectiveMode === "video");

      modeRef.current = effectiveMode;
      setModeState(effectiveMode);

      let ch = channelRef.current;
      const firstJoin = !ch;
      if (!ch) {
        ch = supabase.channel(`media:${roomId}`, {
          config: { presence: { key: myId }, broadcast: { self: false } },
        });
        channelRef.current = ch;

        ch.on("presence", { event: "sync" }, () => {
          const state = ch!.presenceState() as Record<string, Array<PresenceMeta>>;
          const ids = Object.keys(state).filter((k) => k !== "lurker" && k !== myId);
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
          setPeers((prev) => {
            const next = { ...prev };
            for (const [pid, metas] of allEntries) {
              if (pid === myId) continue;
              const pmode = (metas[0]?.mode ?? "voice") as MediaMode;
              if (next[pid]) next[pid] = { ...next[pid], mode: pmode };
            }
            return next;
          });
          for (const peerId of Array.from(pcsRef.current.keys())) {
            if (!ids.includes(peerId) || !state[peerId]?.[0]) {
              closePeer(peerId);
            }
          }
        });

        ch.on("presence", { event: "join" }, ({ key, newPresences }) => {
          if (key === "lurker" || key === myId) return;
          const peerMode = (((newPresences[0] as unknown) as PresenceMeta | undefined)?.mode ?? "voice") as MediaMode;
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
        await ch.track({ mode: effectiveMode, joined_at: new Date().toISOString() } satisfies PresenceMeta);
      }

      {
        const state = ch.presenceState() as Record<string, Array<PresenceMeta>>;
        const others = Object.entries(state).filter(
          ([k]) => k !== "lurker" && k !== myId,
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

  // Toggle camera on/off WITHOUT renegotiating peers when already on video.
  // From voice → video, this triggers a full re-join via setMode("video").
  const setCameraEnabled = useCallback((on: boolean) => {
    const stream = localStreamRef.current;
    if (modeRef.current === "video" && stream) {
      const tracks = stream.getVideoTracks();
      if (tracks.length > 0) {
        for (const t of tracks) t.enabled = on;
        setCameraOnState(on);
        return;
      }
    }
    if (on) {
      // Promote voice → video (full re-acquire).
      joinWithMode("video");
    } else {
      // Demote video → voice (full re-acquire so cam light is OFF).
      joinWithMode("voice");
    }
  }, [joinWithMode]);

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
    cameraOn,
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
    setCameraEnabled,
    cap: ROOM_CAP,
    videoCap: VIDEO_CAP,
  };
}

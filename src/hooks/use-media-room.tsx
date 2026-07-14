import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  mintTurnCreds,
  recordWebrtcConnection,
  recordWebrtcRelayEnd,
  recordWebrtcSnapshot,
} from "@/lib/turn.functions";
import { pickProfile, stepDown, type BitrateProfile } from "@/lib/mesh-bitrate";

const STUN_ONLY: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

// How long to wait for ICE to reach "connected" before assuming the direct
// peer-to-peer path won't work and upgrading this pair to TURN relay.
const ICE_CHECKING_TIMEOUT_MS = 8000;

// How long ICE may stay in "disconnected" before we escalate to restartIce.
// Covers a brief Wi-Fi blip / packet loss burst without visible impact.
const ICE_DISCONNECT_GRACE_MS = 5000;

// Max ICE restarts per peer inside a 30s window before falling back to a TURN
// teardown-and-recreate. Prevents restart loops during sustained loss.
const ICE_RESTART_WINDOW_MS = 30_000;
const ICE_RESTART_MAX_ATTEMPTS = 2;

// Visibility "was hidden long enough to warrant a revalidate" threshold.
const HIDDEN_REVALIDATE_MS = 10_000;

// -----------------------------------------------------------------------------
// WebRTC connection mode. Controlled via VITE_WEBRTC_MODE build-time env var.
//   "auto"        — production default. Direct-first, relay only on failure.
//   "force-turn"  — staging: every pair is created with relay-only ICE policy so
//                   we can exercise the TURN path without waiting for a natural
//                   failure. Never enable in production.
//   "direct-only" — dev: never mint TURN, never upgrade a failing pair. Used to
//                   validate the direct path in isolation.
// -----------------------------------------------------------------------------
type WebrtcMode = "auto" | "force-turn" | "direct-only";
const WEBRTC_MODE: WebrtcMode = (() => {
  const raw = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.VITE_WEBRTC_MODE;
  if (raw === "force-turn" || raw === "direct-only") return raw;
  return "auto";
})();

function newSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    try { return crypto.randomUUID(); } catch { /* noop */ }
  }
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function detectBrowserFamily(): "chrome" | "firefox" | "safari" | "edge" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  if (/edg\//i.test(ua)) return "edge";
  if (/firefox\//i.test(ua)) return "firefox";
  if (/chrome\//i.test(ua)) return "chrome";
  if (/safari\//i.test(ua)) return "safari";
  return "other";
}

function detectDeviceClass(): "mobile" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const uad = (navigator as unknown as { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (uad && typeof uad.mobile === "boolean") return uad.mobile ? "mobile" : "desktop";
  if (typeof window !== "undefined" && window.matchMedia) {
    if (window.matchMedia("(pointer: coarse)").matches) return "mobile";
  }
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || "") ? "mobile" : "desktop";
}

async function inspectCandidatePair(pc: RTCPeerConnection): Promise<{
  path: "direct" | "relayed" | "failed";
  localType?: "host" | "srflx" | "prflx" | "relay";
  remoteType?: "host" | "srflx" | "prflx" | "relay";
  bytesSent?: number;
  bytesReceived?: number;
}> {
  try {
    const stats = await pc.getStats();
    let selectedPair: unknown = null;
    let transportSelectedPairId: string | undefined;
    const byId = new Map<string, unknown>();
    stats.forEach((r) => byId.set((r as { id: string }).id, r));
    stats.forEach((r) => {
      const rec = r as { type?: string; selected?: boolean; nominated?: boolean; state?: string; selectedCandidatePairId?: string };
      if (rec.type === "transport" && rec.selectedCandidatePairId) {
        transportSelectedPairId = rec.selectedCandidatePairId;
      }
      if (rec.type === "candidate-pair" && (rec.selected || (rec.nominated && rec.state === "succeeded"))) {
        selectedPair = r;
      }
    });
    if (!selectedPair && transportSelectedPairId) {
      selectedPair = byId.get(transportSelectedPairId) ?? null;
    }
    if (!selectedPair) return { path: "failed" };
    const pair = selectedPair as {
      localCandidateId?: string;
      remoteCandidateId?: string;
      bytesSent?: number;
      bytesReceived?: number;
    };
    const local = pair.localCandidateId ? (byId.get(pair.localCandidateId) as { candidateType?: string } | undefined) : undefined;
    const remote = pair.remoteCandidateId ? (byId.get(pair.remoteCandidateId) as { candidateType?: string } | undefined) : undefined;
    const localType = (local?.candidateType ?? undefined) as "host" | "srflx" | "prflx" | "relay" | undefined;
    const remoteType = (remote?.candidateType ?? undefined) as "host" | "srflx" | "prflx" | "relay" | undefined;
    const path: "direct" | "relayed" = localType === "relay" || remoteType === "relay" ? "relayed" : "direct";
    return {
      path,
      localType,
      remoteType,
      bytesSent: pair.bytesSent,
      bytesReceived: pair.bytesReceived,
    };
  } catch {
    return { path: "failed" };
  }
}

export const ROOM_CAP = 5;
export const VIDEO_CAP = 5;

export type MediaMode = "voice" | "video";

export type MediaPeer = {
  userId: string;
  speaking: boolean;
  mode: MediaMode;
  stream: MediaStream | null;
};

// -----------------------------------------------------------------------------
// Signal envelope.
// Every offer/answer/ICE message carries room + sender-session + pc-generation
// so late messages from a stale room / previous browser session / closed PC
// cannot resurrect an obsolete connection. All fields optional at parse time
// so an older client emitting a bare payload still works.
// -----------------------------------------------------------------------------
type SignalMeta = {
  room?: string;
  sess?: string;      // sender's per-join session id
  gen?: number;       // sender's PC generation for this pair
  targetSess?: string; // receiver's session id (set on answers, ICE)
};

type SignalEvent =
  | (SignalMeta & { type: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit })
  | (SignalMeta & { type: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit })
  | (SignalMeta & { type: "ice"; from: string; to: string; candidate: RTCIceCandidateInit })
  | (SignalMeta & { type: "speaking"; from: string; speaking: boolean })
  | (SignalMeta & { type: "screen"; from: string; active: boolean });

type PresenceMeta = { mode: MediaMode; joined_at: string; sess?: string };

// Per-peer runtime state kept alongside the RTCPeerConnection.
type PeerMeta = {
  // Perfect-negotiation
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
  // Session + generation identity
  localGen: number;               // increments each createPeer for this peerId
  remoteSess: string | null;      // learned from first inbound signal / presence
  remoteGen: number;              // highest remoteGen seen; older discarded
  // Recovery
  restartAttempts: number[];      // timestamps within ICE_RESTART_WINDOW_MS
  restartInFlight: boolean;
  disconnectTimer: number | null;
  // Existing telemetry
  startedAt: number;
  turnAttempted: boolean;
  turnSucceeded: boolean;
  recorded: boolean;
  eventId: string | null;
  finalRelayed: boolean;
  // Buffered ICE per gen — early candidates before remoteDescription is set.
  pendingIce: Map<number, RTCIceCandidateInit[]>;
};

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
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [bandwidthReduced, setBandwidthReduced] = useState(false);
  const [screenSharerId, setScreenSharerId] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const peerMetaRef = useRef<Map<string, PeerMeta>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const speakingStopRef = useRef<(() => void) | null>(null);
  const lastSpeakingSentRef = useRef<boolean>(false);
  const modeRef = useRef<MediaMode>("voice");
  const screenStreamRef = useRef<MediaStream | null>(null);
  const originalCamTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenBusyRef = useRef<boolean>(false);

  // Session identity — nulled by leave() so late signals are dropped.
  const sessionIdRef = useRef<string | null>(null);
  const roomIdRef = useRef<string | undefined>(roomId);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);

  // Visibility / revalidate bookkeeping
  const hiddenSinceRef = useRef<number | null>(null);
  const revalidateInFlightRef = useRef<boolean>(false);

  // ---- TURN fallback (session-cached) ---------------------------------------
  const turnIceServersRef = useRef<RTCIceServer[] | null>(null);
  const turnFetchPromiseRef = useRef<Promise<RTCIceServer[]> | null>(null);
  const turnExpiresAtRef = useRef<number>(0);
  const pairUsedTurnRef = useRef<Set<string>>(new Set());
  const pairCheckTimersRef = useRef<Map<string, number>>(new Map());
  const iceErrorRef = useRef<Map<string, number>>(new Map());

  // ---- bandwidth governor ---------------------------------------------------
  const profileRef = useRef<BitrateProfile>(pickProfile(1, false));
  const adaptiveFloorRef = useRef<BitrateProfile | null>(null);
  const statsTimerRef = useRef<number | null>(null);
  const consecutiveBwLimitedRef = useRef<Map<string, number>>(new Map());

  async function getTurnIceServers(forceRefresh = false): Promise<RTCIceServer[]> {
    const now = Date.now();
    if (
      !forceRefresh &&
      turnIceServersRef.current &&
      turnExpiresAtRef.current > now + 60_000
    ) {
      return turnIceServersRef.current;
    }
    if (turnFetchPromiseRef.current) return turnFetchPromiseRef.current;

    turnFetchPromiseRef.current = (async () => {
      const res = await mintTurnCreds({
        data: { roomId, ttlSeconds: 600, envMode: WEBRTC_MODE },
      });
      const servers = Array.isArray(res.iceServers) ? res.iceServers : [];
      const usable = servers.filter(
        (s) => s && typeof s === "object" && "urls" in s && (typeof s.urls === "string" || Array.isArray(s.urls)),
      );
      if (usable.length === 0) throw new Error("TURN response had no usable iceServers");
      turnIceServersRef.current = usable;
      turnExpiresAtRef.current = new Date(res.expiresAt).getTime();
      return usable;
    })();

    try {
      return await turnFetchPromiseRef.current;
    } finally {
      turnFetchPromiseRef.current = null;
    }
  }

  async function applyBudget() {
    const profile = profileRef.current;
    const screenActive = profile.screenKbps > 0;
    const localCamTrack = (modeRef.current === "video"
      ? localStreamRef.current?.getVideoTracks()[0] ?? null
      : null);
    const localScreenTrack = screenStreamRef.current?.getVideoTracks()[0] ?? null;

    if (localCamTrack && !screenActive) {
      try {
        await localCamTrack.applyConstraints({
          frameRate: { max: profile.camFps },
          height: { max: profile.camMaxHeight },
        });
      } catch { /* noop */ }
    }
    if (localScreenTrack) {
      try {
        localScreenTrack.contentHint = "detail";
        await localScreenTrack.applyConstraints({ frameRate: { max: profile.screenFps } });
      } catch { /* noop */ }
    }
    if (localCamTrack) {
      try { localCamTrack.contentHint = "motion"; } catch { /* noop */ }
    }

    for (const pc of pcsRef.current.values()) {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (!sender || !sender.track) continue;
      const isScreen = sender.track === localScreenTrack;
      const kbps = isScreen ? profile.screenKbps : profile.camKbps;
      const fps = isScreen ? profile.screenFps : profile.camFps;
      if (kbps <= 0) continue;
      try {
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }
        params.encodings[0] = {
          ...params.encodings[0],
          maxBitrate: kbps * 1000,
          maxFramerate: fps,
        };
        params.degradationPreference = isScreen ? "maintain-framerate" : "balanced";
        await sender.setParameters(params);
      } catch { /* noop */ }
    }
  }

  function startStatsPoller() {
    if (statsTimerRef.current !== null) return;
    const tick = async () => {
      try {
        let shouldStepDown = false;
        for (const [peerId, pc] of pcsRef.current.entries()) {
          const stats = await pc.getStats();
          let bwLimited = false;
          stats.forEach((r) => {
            const rec = r as { type?: string; kind?: string; qualityLimitationReason?: string };
            if (rec.type === "outbound-rtp" && rec.kind === "video" && rec.qualityLimitationReason === "bandwidth") {
              bwLimited = true;
            }
          });
          const prev = consecutiveBwLimitedRef.current.get(peerId) ?? 0;
          const next = bwLimited ? prev + 1 : 0;
          consecutiveBwLimitedRef.current.set(peerId, next);
          if (next >= 2) shouldStepDown = true;
        }
        if (shouldStepDown) {
          const screenActive = profileRef.current.screenKbps > 0;
          const stepped = stepDown(profileRef.current, screenActive);
          if (stepped) {
            profileRef.current = stepped;
            adaptiveFloorRef.current = stepped;
            setBandwidthReduced(true);
            consecutiveBwLimitedRef.current.clear();
            applyBudget().catch(() => {});
          }
        }
      } catch { /* noop */ }
    };
    statsTimerRef.current = window.setInterval(tick, 4000);
  }

  function stopStatsPoller() {
    if (statsTimerRef.current !== null) {
      clearInterval(statsTimerRef.current);
      statsTimerRef.current = null;
    }
    consecutiveBwLimitedRef.current.clear();
  }

  function rebudget(peerCount: number, screenActive: boolean) {
    const base = pickProfile(peerCount, screenActive);
    const floor = adaptiveFloorRef.current;
    const next = floor && (floor.screenKbps > 0) === screenActive
      ? { ...base,
          camKbps: Math.min(base.camKbps, floor.camKbps),
          screenKbps: Math.min(base.screenKbps || floor.screenKbps, floor.screenKbps || base.screenKbps) }
      : base;
    profileRef.current = next;
    applyBudget().catch(() => {});
  }

  function attachStream(peerId: string, stream: MediaStream) {
    setPeers((prev) => ({
      ...prev,
      [peerId]: { ...(prev[peerId] ?? { userId: peerId, speaking: false, mode: "voice" }), stream },
    }));
  }

  // -------------------------------------------------------------------------
  // Signaling helpers — every outbound signal is stamped with the current
  // room/session/gen so the receiver can drop stale messages.
  // -------------------------------------------------------------------------
  type OutboundSignal =
    | { type: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
    | { type: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
    | { type: "ice"; from: string; to: string; candidate: RTCIceCandidateInit };
  function sendSignal(peerId: string, evt: OutboundSignal) {
    const ch = channelRef.current;
    if (!ch || !myId || !sessionIdRef.current) return;
    const meta = peerMetaRef.current.get(peerId);
    const payload: SignalEvent = {
      ...evt,
      room: roomIdRef.current,
      sess: sessionIdRef.current,
      gen: meta?.localGen,
      targetSess: meta?.remoteSess ?? undefined,
    } as SignalEvent;
    ch.send({ type: "broadcast", event: "signal", payload });
  }

  async function submitRelayEnd(peerId: string, pc: RTCPeerConnection) {
    const meta = peerMetaRef.current.get(peerId);
    if (!meta || !meta.eventId || !meta.finalRelayed) return;
    try {
      const stats = await inspectCandidatePair(pc);
      await recordWebrtcRelayEnd({
        data: {
          eventId: meta.eventId,
          bytesSent: stats.bytesSent,
          bytesReceived: stats.bytesReceived,
        },
      });
    } catch (e) {
      console.warn("recordWebrtcRelayEnd failed", e);
    }
  }

  function clearCheckTimer(peerId: string) {
    const t = pairCheckTimersRef.current.get(peerId);
    if (t) {
      clearTimeout(t);
      pairCheckTimersRef.current.delete(peerId);
    }
  }

  function clearDisconnectTimer(peerId: string) {
    const meta = peerMetaRef.current.get(peerId);
    if (meta && meta.disconnectTimer !== null) {
      clearTimeout(meta.disconnectTimer);
      meta.disconnectTimer = null;
    }
  }

  function closePeer(peerId: string) {
    clearCheckTimer(peerId);
    clearDisconnectTimer(peerId);
    const pc = pcsRef.current.get(peerId);
    if (pc) {
      void submitRelayEnd(peerId, pc);
      try { pc.close(); } catch { /* noop */ }
      pcsRef.current.delete(peerId);
    }
    peerMetaRef.current.delete(peerId);
    iceErrorRef.current.delete(peerId);
    setPeers((prev) => {
      if (!(peerId in prev)) return prev;
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  }

  // -------------------------------------------------------------------------
  // Recovery: ICE restart with bounded retries, TURN swap as last resort.
  // -------------------------------------------------------------------------
  async function scheduleIceRestart(peerId: string) {
    const pc = pcsRef.current.get(peerId);
    const meta = peerMetaRef.current.get(peerId);
    if (!pc || !meta) return;
    if (meta.restartInFlight) return;

    // Prune old attempt timestamps.
    const now = Date.now();
    meta.restartAttempts = meta.restartAttempts.filter((t) => now - t < ICE_RESTART_WINDOW_MS);
    if (meta.restartAttempts.length >= ICE_RESTART_MAX_ATTEMPTS) {
      // Exhausted — fall back to a TURN teardown/recreate.
      if (WEBRTC_MODE === "auto" && !pairUsedTurnRef.current.has(peerId)) {
        upgradePeerToTurn(peerId, peers[peerId]?.mode ?? "voice");
      } else {
        void maybeRecordFailed(peerId);
        closePeer(peerId);
      }
      return;
    }
    meta.restartInFlight = true;
    meta.restartAttempts.push(now);

    try {
      // Refresh near-expiry TURN creds so a restart doesn't inherit a dead ticket.
      if (WEBRTC_MODE === "auto" && turnExpiresAtRef.current > 0 &&
          turnExpiresAtRef.current < Date.now() + 60_000) {
        try { await getTurnIceServers(true); } catch { /* noop */ }
      }
      // Only the impolite side proactively fires the restart offer; the polite
      // side lets onnegotiationneeded be triggered by the incoming offer's
      // ICE-restart. If both fire, perfect negotiation handles the glare.
      if (!meta.polite && typeof pc.restartIce === "function") {
        try { pc.restartIce(); } catch { /* noop — old Safari */ }
      } else if (typeof pc.restartIce === "function") {
        // Polite side: still call restartIce so incoming ICE-restart offer is
        // accepted cleanly.
        try { pc.restartIce(); } catch { /* noop */ }
      }
    } finally {
      // Release after a short delay so a follow-up state change doesn't stack
      // a second attempt immediately.
      setTimeout(() => {
        const m = peerMetaRef.current.get(peerId);
        if (m) m.restartInFlight = false;
      }, 2000);
    }
  }

  async function upgradePeerToTurn(peerId: string, peerMode: MediaMode) {
    if (WEBRTC_MODE === "direct-only") return;
    if (pairUsedTurnRef.current.has(peerId)) return;
    pairUsedTurnRef.current.add(peerId);
    clearCheckTimer(peerId);

    const nearExpiry = turnExpiresAtRef.current > 0 && turnExpiresAtRef.current < Date.now() + 60_000;
    let turnServers: RTCIceServer[];
    try {
      turnServers = await getTurnIceServers(nearExpiry);
    } catch (e) {
      console.warn("TURN mint failed", e);
      const meta = peerMetaRef.current.get(peerId);
      if (meta) { meta.turnAttempted = true; meta.turnSucceeded = false; }
      closePeer(peerId);
      return;
    }

    const meta = peerMetaRef.current.get(peerId);
    if (meta) meta.turnAttempted = true;

    // Preserve remoteSess/gen counter across the swap so the new PC's meta
    // still discards stale signals from the previous generation.
    const preservedRemoteSess = meta?.remoteSess ?? null;
    const nextGen = (meta?.localGen ?? 0) + 1;

    closePeer(peerId);
    const pc = createPeer(peerId, peerMode, [...STUN_ONLY, ...turnServers], nextGen);
    const newMeta = peerMetaRef.current.get(peerId);
    if (newMeta) {
      newMeta.turnAttempted = true;
      newMeta.remoteSess = preservedRemoteSess;
    }
    // Perfect negotiation will drive the offer on both sides via
    // onnegotiationneeded now that addTrack has fired inside createPeer.
  }

  function createPeer(
    peerId: string,
    peerMode: MediaMode,
    iceServers: RTCIceServer[] = STUN_ONLY,
    localGen: number = 1,
  ): RTCPeerConnection {
    const iceTransportPolicy: RTCIceTransportPolicy | undefined =
      WEBRTC_MODE === "force-turn" ? "relay" : undefined;
    const pc = new RTCPeerConnection({ iceServers, iceTransportPolicy });
    pcsRef.current.set(peerId, pc);

    const meta: PeerMeta = {
      polite: !!myId && myId < peerId,
      makingOffer: false,
      ignoreOffer: false,
      isSettingRemoteAnswerPending: false,
      localGen,
      remoteSess: null,
      remoteGen: 0,
      restartAttempts: [],
      restartInFlight: false,
      disconnectTimer: null,
      startedAt: performance.now(),
      turnAttempted: WEBRTC_MODE === "force-turn",
      turnSucceeded: false,
      recorded: false,
      eventId: null,
      finalRelayed: false,
      pendingIce: new Map(),
    };
    peerMetaRef.current.set(peerId, meta);

    setPeers((prev) => ({
      ...prev,
      [peerId]: { userId: peerId, speaking: false, mode: peerMode, stream: prev[peerId]?.stream ?? null },
    }));

    const local = localStreamRef.current;
    if (local) for (const t of local.getTracks()) pc.addTrack(t, local);

    // If a screen share is already active locally, add its track too so the
    // new peer immediately receives the share once negotiation completes.
    const screen = screenStreamRef.current;
    if (screen) {
      for (const t of screen.getTracks()) {
        try { pc.addTrack(t, screen); } catch { /* noop */ }
      }
    }

    pc.ontrack = (ev) => {
      const [stream] = ev.streams;
      if (stream) attachStream(peerId, stream);
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        sendSignal(peerId, { type: "ice", from: myId!, to: peerId, candidate: ev.candidate.toJSON() });
      }
    };

    try {
      (pc as unknown as { onicecandidateerror: ((e: RTCPeerConnectionIceErrorEvent) => void) | null })
        .onicecandidateerror = (e) => {
        const count = (iceErrorRef.current.get(peerId) ?? 0) + 1;
        iceErrorRef.current.set(peerId, count);
        if (count <= 3) {
          console.warn("ICE candidate error", {
            errorCode: e.errorCode,
            errorText: e.errorText,
            url: e.url,
          });
        }
      };
    } catch { /* noop */ }

    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      const m = peerMetaRef.current.get(peerId);
      if (!m) return;
      if (s === "connected" || s === "completed") {
        clearCheckTimer(peerId);
        clearDisconnectTimer(peerId);
        void maybeRecordConnected(peerId, pc);
      } else if (s === "checking") {
        if (
          WEBRTC_MODE === "auto" &&
          !pairCheckTimersRef.current.has(peerId) &&
          !pairUsedTurnRef.current.has(peerId)
        ) {
          const t = window.setTimeout(() => {
            pairCheckTimersRef.current.delete(peerId);
            if (pcsRef.current.get(peerId) === pc &&
                (pc.iceConnectionState === "checking" || pc.iceConnectionState === "new")) {
              upgradePeerToTurn(peerId, peerMode);
            }
          }, ICE_CHECKING_TIMEOUT_MS);
          pairCheckTimersRef.current.set(peerId, t);
        }
      } else if (s === "disconnected") {
        // Grace period — many transient blips resolve on their own.
        if (m.disconnectTimer === null) {
          m.disconnectTimer = window.setTimeout(() => {
            m.disconnectTimer = null;
            const cur = pcsRef.current.get(peerId);
            if (cur !== pc) return;
            const st = pc.iceConnectionState;
            if (st === "disconnected" || st === "failed") {
              scheduleIceRestart(peerId).catch(() => {});
            }
          }, ICE_DISCONNECT_GRACE_MS);
        }
      } else if (s === "failed") {
        clearDisconnectTimer(peerId);
        scheduleIceRestart(peerId).catch(() => {});
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        // Escalate: try ICE restart first; if we've already exhausted, that
        // path falls through to TURN or closePeer.
        scheduleIceRestart(peerId).catch(() => {});
      }
    };

    // Perfect negotiation: fires on both sides, both may attempt. Collision
    // is resolved in handleSignal via polite/ignoreOffer.
    pc.onnegotiationneeded = async () => {
      if (!myId || !sessionIdRef.current) return;
      try {
        meta.makingOffer = true;
        await pc.setLocalDescription();
        if (pc.localDescription) {
          sendSignal(peerId, { type: "offer", from: myId, to: peerId, sdp: pc.localDescription.toJSON() });
        }
      } catch (e) {
        console.warn("negotiationneeded failed", e);
      } finally {
        meta.makingOffer = false;
      }
    };

    return pc;
  }

  async function maybeRecordConnected(peerId: string, pc: RTCPeerConnection) {
    const meta = peerMetaRef.current.get(peerId);
    if (!meta || meta.recorded) return;
    meta.recorded = true;
    const stats = await inspectCandidatePair(pc);
    if (stats.path === "relayed") {
      meta.turnSucceeded = true;
      meta.finalRelayed = true;
    }
    try {
      const res = await recordWebrtcConnection({
        data: {
          roomId,
          path: stats.path,
          localCandidateType: stats.localType,
          remoteCandidateType: stats.remoteType,
          turnAttempted: meta.turnAttempted,
          turnSucceeded: meta.turnSucceeded,
          connectMs: Math.max(0, Math.round(performance.now() - meta.startedAt)),
          participantCount: pcsRef.current.size,
          browserFamily: detectBrowserFamily(),
          deviceClass: detectDeviceClass(),
          envMode: WEBRTC_MODE,
        },
      });
      meta.eventId = res.id;
    } catch (e) {
      console.warn("recordWebrtcConnection failed", e);
    }
  }

  async function maybeRecordFailed(peerId: string) {
    const meta = peerMetaRef.current.get(peerId);
    if (!meta || meta.recorded) return;
    meta.recorded = true;
    try {
      await recordWebrtcConnection({
        data: {
          roomId,
          path: "failed",
          turnAttempted: meta.turnAttempted,
          turnSucceeded: false,
          connectMs: Math.max(0, Math.round(performance.now() - meta.startedAt)),
          participantCount: pcsRef.current.size,
          browserFamily: detectBrowserFamily(),
          deviceClass: detectDeviceClass(),
          envMode: WEBRTC_MODE,
        },
      });
    } catch (e) {
      console.warn("recordWebrtcConnection (failed) failed", e);
    }
  }

  function ensurePeer(peerId: string, peerMode: MediaMode = "voice"): RTCPeerConnection {
    const existing = pcsRef.current.get(peerId);
    if (existing) return existing;
    if (WEBRTC_MODE === "force-turn" && turnIceServersRef.current) {
      return createPeer(peerId, peerMode, [...STUN_ONLY, ...turnIceServersRef.current], 1);
    }
    return createPeer(peerId, peerMode, STUN_ONLY, 1);
  }

  async function drainPendingIce(peerId: string, pc: RTCPeerConnection) {
    const meta = peerMetaRef.current.get(peerId);
    if (!meta) return;
    const buf = meta.pendingIce.get(meta.localGen);
    if (!buf || buf.length === 0) return;
    meta.pendingIce.delete(meta.localGen);
    for (const c of buf) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* noop */ }
    }
  }

  // -------------------------------------------------------------------------
  // Perfect-negotiation signal handler.
  // -------------------------------------------------------------------------
  async function handleSignal(ev: SignalEvent) {
    if (!myId || !sessionIdRef.current) return;
    if (ev.room && ev.room !== roomIdRef.current) return;
    if ("to" in ev && ev.to !== myId) return;
    if (ev.from === myId) return;
    // Reject messages addressed to a previous session of ours.
    if (ev.targetSess && ev.targetSess !== sessionIdRef.current) return;

    if (ev.type === "speaking") {
      setPeers((prev) => {
        const cur = prev[ev.from];
        if (!cur || cur.speaking === ev.speaking) return prev;
        return { ...prev, [ev.from]: { ...cur, speaking: ev.speaking } };
      });
      return;
    }
    if (ev.type === "screen") {
      setScreenSharerId((cur) => {
        if (ev.active) return ev.from;
        return cur === ev.from ? null : cur;
      });
      adaptiveFloorRef.current = null;
      rebudget(count, ev.active || !!screenStreamRef.current);
      return;
    }

    // For offer/answer/ice we need a PC; create on offer if none exists.
    let pc = pcsRef.current.get(ev.from);
    let meta = pc ? peerMetaRef.current.get(ev.from) : null;

    // If the sender identifies a new session and we already had a PC for a
    // previous session, tear it down before making a new one.
    if (pc && meta && ev.sess && meta.remoteSess && meta.remoteSess !== ev.sess) {
      closePeer(ev.from);
      pc = undefined;
      meta = null;
    }

    if (ev.type === "offer") {
      if (!pc) {
        pc = ensurePeer(ev.from);
        meta = peerMetaRef.current.get(ev.from) ?? null;
      }
      if (!pc || !meta) return;

      // Learn remote identity.
      if (ev.sess && !meta.remoteSess) meta.remoteSess = ev.sess;
      if (typeof ev.gen === "number") {
        if (ev.gen < meta.remoteGen) return; // stale
        meta.remoteGen = ev.gen;
      }

      const readyForOffer =
        !meta.makingOffer &&
        (pc.signalingState === "stable" || meta.isSettingRemoteAnswerPending);
      const offerCollision = !readyForOffer;
      meta.ignoreOffer = !meta.polite && offerCollision;
      if (meta.ignoreOffer) return;

      try {
        // In modern browsers passing the offer directly handles implicit
        // rollback when needed. Fall back to explicit rollback for safety.
        if (offerCollision && meta.polite) {
          try { await pc.setLocalDescription({ type: "rollback" } as RTCSessionDescriptionInit); }
          catch { /* noop — implicit rollback via setRemoteDescription below */ }
        }
        await pc.setRemoteDescription(new RTCSessionDescription(ev.sdp));
        await drainPendingIce(ev.from, pc);
        await pc.setLocalDescription(await pc.createAnswer());
        if (pc.localDescription) {
          sendSignal(ev.from, { type: "answer", from: myId, to: ev.from, sdp: pc.localDescription.toJSON() });
        }
      } catch (e) {
        console.warn("handleSignal(offer) failed", e);
      }
      return;
    }

    if (!pc || !meta) return;
    if (ev.sess && !meta.remoteSess) meta.remoteSess = ev.sess;
    if (typeof ev.gen === "number" && ev.gen < meta.remoteGen) return;

    if (ev.type === "answer") {
      if (meta.ignoreOffer) { meta.ignoreOffer = false; return; }
      if (pc.signalingState !== "have-local-offer") return;
      try {
        meta.isSettingRemoteAnswerPending = true;
        await pc.setRemoteDescription(new RTCSessionDescription(ev.sdp));
        meta.isSettingRemoteAnswerPending = false;
        await drainPendingIce(ev.from, pc);
      } catch (e) {
        meta.isSettingRemoteAnswerPending = false;
        console.warn("handleSignal(answer) failed", e);
      }
      return;
    }

    if (ev.type === "ice") {
      // Buffer until remoteDescription is set — otherwise addIceCandidate
      // throws InvalidStateError silently and we lose reachability info.
      if (!pc.remoteDescription) {
        const buf = meta.pendingIce.get(meta.localGen) ?? [];
        buf.push(ev.candidate);
        meta.pendingIce.set(meta.localGen, buf);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(ev.candidate));
      } catch (e) {
        // Never fatal — a bad candidate from a stale generation shouldn't
        // kill the pair, let alone the whole mesh.
        if (!meta.ignoreOffer) console.debug("addIceCandidate skipped", e);
      }
      return;
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
            payload: {
              type: "speaking", from: myId, speaking: active,
              room: roomIdRef.current, sess: sessionIdRef.current ?? undefined,
            } satisfies SignalEvent,
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
    return () => { supabase.removeChannel(ch); };
  }, [roomId]);

  function teardownMedia() {
    stopStatsPoller();
    adaptiveFloorRef.current = null;
    setBandwidthReduced(false);
    for (const peerId of Array.from(pcsRef.current.keys())) closePeer(peerId);
    for (const t of pairCheckTimersRef.current.values()) clearTimeout(t);
    pairCheckTimersRef.current.clear();
    pairUsedTurnRef.current.clear();
    peerMetaRef.current.clear();
    iceErrorRef.current.clear();
    turnIceServersRef.current = null;
    turnExpiresAtRef.current = 0;
    if (localStreamRef.current) {
      for (const t of localStreamRef.current.getTracks()) t.stop();
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      for (const t of screenStreamRef.current.getTracks()) t.stop();
      screenStreamRef.current = null;
    }
    originalCamTrackRef.current = null;
    screenBusyRef.current = false;
    setScreenStream(null);
    setScreenSharerId(null);
    if (speakingStopRef.current) speakingStopRef.current();
    setSpeaking(false);
    setMuted(false);
    setCameraOnState(false);
    lastSpeakingSentRef.current = false;
  }

  const leave = useCallback(() => {
    // Null the session id BEFORE tearing down so any inbound signal already
    // queued in the broadcast handler is dropped by handleSignal.
    sessionIdRef.current = null;
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

  // -------------------------------------------------------------------------
  // Revalidate: called after visibility restore, bfcache pageshow, online, or
  // signaling-channel error. Idempotent and non-destructive to healthy peers.
  // -------------------------------------------------------------------------
  const revalidate = useCallback(async () => {
    if (!joined || !myId || !roomIdRef.current || !sessionIdRef.current) return;
    if (revalidateInFlightRef.current) return;
    revalidateInFlightRef.current = true;
    try {
      // Verify local tracks still live; re-acquire silently if the OS revoked
      // them during sleep.
      const local = localStreamRef.current;
      const deadAudio = local?.getAudioTracks().some((t) => t.readyState === "ended");
      const deadVideo = modeRef.current === "video" &&
        local?.getVideoTracks().some((t) => t.readyState === "ended");
      if (deadAudio || deadVideo) {
        try {
          const fresh = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: modeRef.current === "video"
              ? { width: { ideal: 480 }, height: { ideal: 360 }, frameRate: { ideal: 24 } }
              : false,
          });
          if (local) for (const t of local.getTracks()) t.stop();
          localStreamRef.current = fresh;
          const newAudio = fresh.getAudioTracks()[0] ?? null;
          const newVideo = fresh.getVideoTracks()[0] ?? null;
          for (const pc of pcsRef.current.values()) {
            for (const s of pc.getSenders()) {
              if (s.track?.kind === "audio" && newAudio) {
                try { await s.replaceTrack(newAudio); } catch { /* noop */ }
              } else if (s.track?.kind === "video" && !screenStreamRef.current && newVideo) {
                try { await s.replaceTrack(newVideo); } catch { /* noop */ }
              }
            }
          }
          if (fresh.getAudioTracks().length > 0) startSpeakingDetector(fresh);
        } catch (e) {
          console.warn("revalidate: re-acquire failed", e);
        }
      }

      // Ask each unhealthy PC to restart ICE. Perfect negotiation handles
      // both-sides-calling-restart cleanly.
      for (const [peerId, pc] of pcsRef.current.entries()) {
        const s = pc.iceConnectionState;
        if (s !== "connected" && s !== "completed") {
          scheduleIceRestart(peerId).catch(() => {});
        }
      }
    } finally {
      revalidateInFlightRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, myId]);

  // Visibility / bfcache / online / channel error triggers.
  useEffect(() => {
    if (!joined) return;
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        hiddenSinceRef.current = Date.now();
      } else if (document.visibilityState === "visible") {
        const since = hiddenSinceRef.current;
        hiddenSinceRef.current = null;
        if (since && Date.now() - since > HIDDEN_REVALIDATE_MS) {
          revalidate().catch(() => {});
        }
      }
    }
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) revalidate().catch(() => {});
    }
    function onOnline() { revalidate().catch(() => {}); }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("online", onOnline);
    };
  }, [joined, revalidate]);

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

      // Stamp a fresh session id for this join. Cleared by leave().
      sessionIdRef.current = newSessionId();

      if (WEBRTC_MODE === "force-turn") {
        try { await getTurnIceServers(); } catch (e) { console.warn("force-turn prefetch failed", e); }
      } else if (WEBRTC_MODE === "direct-only" && import.meta.env.DEV) {
        console.warn("[WebRTC] direct-only mode — TURN fallback disabled");
      }

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: effectiveMode === "video"
            ? { width: { ideal: 480 }, height: { ideal: 360 }, frameRate: { ideal: 24 } }
            : false,
        });
      } catch (e) {
        if (effectiveMode === "video") {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
              video: false,
            });
            effectiveMode = "voice";
            setError("Camera unavailable — joined with mic only.");
          } catch (e2) {
            const msg = e2 instanceof Error ? e2.message : "Mic blocked";
            setError(`Couldn't access mic: ${msg}`);
            setBusy(false);
            return;
          }
        } else {
          const msg = e instanceof Error ? e.message : "Mic blocked";
          setError(`Couldn't access mic: ${msg}`);
          setBusy(false);
          return;
        }
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
          rebudget(allEntries.length, profileRef.current.screenKbps > 0);
        });

        ch.on("presence", { event: "join" }, ({ key, newPresences }) => {
          if (key === "lurker" || key === myId) return;
          const meta0 = (newPresences[0] as unknown) as PresenceMeta | undefined;
          const peerMode = (meta0?.mode ?? "voice") as MediaMode;
          const pc = ensurePeer(key, peerMode);
          // Learn remote session id from presence so we can drop signals from
          // any prior session of the same user without waiting for an offer.
          const m = peerMetaRef.current.get(key);
          if (m && meta0?.sess) m.remoteSess = meta0.sess;
          // Perfect negotiation drives the offer via onnegotiationneeded when
          // addTrack fires inside createPeer. No lex gate needed.
          void pc;
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
              await ch!.track({
                mode: effectiveMode,
                joined_at: new Date().toISOString(),
                sess: sessionIdRef.current ?? undefined,
              } satisfies PresenceMeta);
              resolve();
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              reject(new Error("Couldn't connect to media channel"));
            }
          });
        });
      } else {
        await ch.track({
          mode: effectiveMode,
          joined_at: new Date().toISOString(),
          sess: sessionIdRef.current ?? undefined,
        } satisfies PresenceMeta);
      }

      {
        const state = ch.presenceState() as Record<string, Array<PresenceMeta>>;
        const others = Object.entries(state).filter(
          ([k]) => k !== "lurker" && k !== myId,
        );
        for (const [peerId, metas] of others) {
          const peerMode = (metas[0]?.mode ?? "voice") as MediaMode;
          const pc = ensurePeer(peerId, peerMode);
          const m = peerMetaRef.current.get(peerId);
          if (m && metas[0]?.sess) m.remoteSess = metas[0].sess;
          void pc;
        }
        void firstJoin;
        if (stream && stream.getAudioTracks().length > 0) startSpeakingDetector(stream);
        const presentCount = Object.keys(ch.presenceState() as Record<string, unknown>).filter((k) => k !== "lurker").length;
        adaptiveFloorRef.current = null;
        rebudget(presentCount, !!screenStreamRef.current);
        startStatsPoller();
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
          payload: {
            type: "speaking", from: myId, speaking: false,
            room: roomIdRef.current, sess: sessionIdRef.current ?? undefined,
          } satisfies SignalEvent,
        });
      }
    }
  }, [muted, myId]);

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
      joinWithMode("video");
    } else {
      joinWithMode("voice");
    }
  }, [joinWithMode]);

  const stopScreenShare = useCallback(async () => {
    const screen = screenStreamRef.current;
    const camTrack = originalCamTrackRef.current;
    screenStreamRef.current = null;
    originalCamTrackRef.current = null;
    setScreenStream(null);
    if (myId) {
      setScreenSharerId((cur) => (cur === myId ? null : cur));
      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "signal",
          payload: {
            type: "screen", from: myId, active: false,
            room: roomIdRef.current, sess: sessionIdRef.current ?? undefined,
          } satisfies SignalEvent,
        });
      }
    }
    for (const pc of pcsRef.current.values()) {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video" || (!s.track && s.transport));
      if (sender) {
        try {
          if (camTrack) {
            await sender.replaceTrack(camTrack);
          } else {
            await sender.replaceTrack(null);
            // Remove the extra sender so the stray m-section is dropped on
            // the next negotiation cycle.
            try { pc.removeTrack(sender); } catch { /* noop */ }
          }
        } catch { /* noop */ }
      }
    }
    if (screen) for (const t of screen.getTracks()) t.stop();
    adaptiveFloorRef.current = null;
    rebudget(count, false);
    screenBusyRef.current = false;
  }, [myId, count]);

  const startScreenShare = useCallback(async () => {
    if (!myId || !channelRef.current) {
      setError("Join the room first.");
      return;
    }
    if (screenStreamRef.current || screenBusyRef.current) return;
    screenBusyRef.current = true;
    let captured: MediaStream;
    try {
      captured = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 12, max: 15 },
          width: { max: 1920 },
          height: { max: 1080 },
        },
        audio: false,
      });
    } catch (e) {
      screenBusyRef.current = false;
      const msg = e instanceof Error ? e.message : "Couldn't start screen share";
      if (!/denied|cancel/i.test(msg)) setError(msg);
      return;
    }
    const screenTrack = captured.getVideoTracks()[0];
    if (!screenTrack) { screenBusyRef.current = false; return; }
    screenTrack.addEventListener("ended", () => { stopScreenShare(); });

    const cam = localStreamRef.current?.getVideoTracks()[0] ?? null;
    originalCamTrackRef.current = cam;
    screenStreamRef.current = captured;
    setScreenStream(captured);
    setScreenSharerId(myId);

    for (const pc of pcsRef.current.values()) {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) {
        try { await sender.replaceTrack(screenTrack); } catch { /* noop */ }
      } else {
        // Voice-only pair: adding a video track triggers onnegotiationneeded
        // on BOTH sides now (perfect negotiation), so the peer will get it.
        try { pc.addTrack(screenTrack, captured); } catch { /* noop */ }
      }
    }

    channelRef.current.send({
      type: "broadcast",
      event: "signal",
      payload: {
        type: "screen", from: myId, active: true,
        room: roomIdRef.current, sess: sessionIdRef.current ?? undefined,
      } satisfies SignalEvent,
    });
    adaptiveFloorRef.current = null;
    rebudget(count, true);
    screenBusyRef.current = false;
  }, [myId, count, stopScreenShare]);

  const setOutboundScreenTrack = useCallback(async (track: MediaStreamTrack | null) => {
    const restore = !track ? screenStreamRef.current?.getVideoTracks()[0] ?? null : track;
    if (!restore) return;
    for (const pc of pcsRef.current.values()) {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) {
        try { await sender.replaceTrack(restore); } catch { /* noop */ }
      }
    }
  }, []);

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
    screenStream,
    screenSharerId,
    isScreenSharing: !!screenStream,
    startScreenShare,
    stopScreenShare,
    setOutboundScreenTrack,
    bandwidthReduced,
    cap: ROOM_CAP,
    videoCap: VIDEO_CAP,
  };
}

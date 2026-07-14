import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, LogOut, Minimize2, Send, MessageSquare, MessageCircle, LayoutGrid, Users, Wrench, MonitorPlay, Maximize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ProfilePeek } from "@/components/profile-peek";
import type { useMediaRoom, MediaPeer } from "@/hooks/use-media-room";

/** Best-effort: derive a human label from a screen capture track.
 *  Chrome's `track.label` is typically "screen:1:0", "window:12345:0", or for
 *  tab captures the tab title. We surface anything that looks like a real
 *  name (contains a letter outside the screen/window/tab prefix) and ignore
 *  the opaque ids. Returns null when nothing meaningful is exposed. */
function screenSourceLabel(stream: MediaStream | null | undefined): string | null {
  if (!stream) return null;
  const track = stream.getVideoTracks()[0];
  const raw = track?.label?.trim();
  if (!raw) return null;
  // Strip Chrome's "screen:1:0" / "window:12345:0" id-only labels.
  if (/^(screen|window|tab|monitor):[\d:]+$/i.test(raw)) return null;
  // Some browsers prefix with "window:Title" — keep the tail.
  const m = raw.match(/^(?:screen|window|tab|monitor):(.+)$/i);
  return (m ? m[1] : raw).trim() || null;
}

export type RoomViewMode = "chat" | "tools" | "gallery" | "collabs";

export type MediaState = ReturnType<typeof useMediaRoom>;

export type ProfileLite = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export type PresenceLite = {
  user_id: string;
  profile?: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
};

export type FullscreenMessage = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
};

export function MediaPanel({
  m,
  channelTitle,
  meDisplay,
  meAvatar,
  meUserId,
  profileLookup,
  others,
  onExit,
  viewMode,
  onViewModeChange,
  onOpenWork,
  roomId,
  dockExtra,
  nextLoungeSlot,
}: {
  m: MediaState;
  channelTitle: string;
  meDisplay: string;
  meAvatar: string | null;
  meUserId: string;
  profileLookup: Map<string, ProfileLite>;
  others: PresenceLite[];
  onExit: () => void;
  viewMode?: RoomViewMode;
  onViewModeChange?: (v: RoomViewMode) => void;
  onOpenWork?: (workId: string) => void;
  roomId?: string;
  /** Optional extra control rendered in the dock alongside Mute/Camera/Exit. */
  dockExtra?: React.ReactNode;
  /** Optional prominent slot (e.g. "Next Lounge") rendered above the Mute/Camera row. */
  nextLoungeSlot?: React.ReactNode;
}) {
  const totalHere = 1 + others.length;
  const peerById = new Map(m.peers.map((p) => [p.userId, p]));
  return (
    <section className="rounded-3xl border border-border/60 bg-surface/70 backdrop-blur-md p-4 shadow-soft">
      <header className="flex items-center gap-2">
        <span className="relative inline-flex h-1.5 w-1.5">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
        </span>
        <h3 className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted truncate">
          Lounge
        </h3>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-muted/70 px-2 py-0.5 text-[11px] text-ink-soft">
          {totalHere}/{m.cap}
        </span>
      </header>

      {viewMode && onViewModeChange && (
        <div className="mt-3 grid grid-cols-4 gap-1 rounded-full bg-muted/60 p-1">
          <ViewPill active={viewMode === "chat"} onClick={() => onViewModeChange("chat")} icon={<MessageCircle className="h-3.5 w-3.5" />} label="Chat" />
          <ViewPill active={viewMode === "tools"} onClick={() => onViewModeChange("tools")} icon={<Wrench className="h-3.5 w-3.5" />} label="Tools" />
          <ViewPill active={viewMode === "gallery"} onClick={() => onViewModeChange("gallery")} icon={<LayoutGrid className="h-3.5 w-3.5" />} label="Work" />
          <ViewPill active={viewMode === "collabs"} onClick={() => onViewModeChange("collabs")} icon={<Users className="h-3.5 w-3.5" />} label="Collabs" />
        </div>
      )}

      {!m.joined ? (
        <p className="mt-3 text-xs text-ink-muted">
          {m.busy ? "Connecting…" : "Joining the Lounge…"}
          {m.error && <span className="block mt-1 text-destructive">{m.error}</span>}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={m.toggleMute}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
                m.muted
                  ? "bg-destructive/10 text-destructive ring-1 ring-destructive/30 hover:bg-destructive/15"
                  : "bg-muted/60 text-ink hover:bg-muted",
              )}
            >
              {m.muted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              {m.muted ? "Unmute" : "Mute"}
            </button>
            <button
              type="button"
              onClick={() => m.setCameraEnabled(!m.cameraOn)}
              disabled={m.busy}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition disabled:opacity-50",
                m.cameraOn
                  ? "bg-muted/60 text-ink hover:bg-muted"
                  : "bg-muted/40 text-ink-soft hover:bg-muted/70",
              )}
            >
              {m.cameraOn ? <Video className="h-3.5 w-3.5" /> : <VideoOff className="h-3.5 w-3.5" />}
              {m.cameraOn ? "Camera off" : "Camera on"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {dockExtra ? (
              <div className="[&_button]:w-full [&_button]:rounded-full [&_button]:!bg-transparent [&_button]:!text-ink-soft [&_button]:hover:!text-ink [&_button]:text-xs">
                {dockExtra}
              </div>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={onExit}
              className="inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition"
            >
              <LogOut className="h-3.5 w-3.5" /> Exit
            </button>
          </div>

          {m.screenSharerId && (
            <p className="rounded-full bg-primary/10 px-3 py-1 text-center text-[11px] text-primary inline-flex items-center justify-center gap-1.5 w-full">
              <MonitorPlay className="h-3 w-3" />
              {m.isScreenSharing
                ? `You're sharing${screenSourceLabel(m.screenStream) ? ` — ${screenSourceLabel(m.screenStream)}` : " your screen"}`
                : "Someone is sharing their screen"}
            </p>
          )}



          <div className="border-t border-border/50 pt-3 mt-1">
            <h4 className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">
              Here now · {totalHere}
            </h4>
            <ul className="space-y-2">
              <SpeakerRow
                key="me"
                userId={meUserId}
                speaking={m.speaking && !m.muted}
                muted={m.muted}
                displayName={meDisplay}
                avatarUrl={meAvatar}
                username={null}
                isMe
                onOpenWork={onOpenWork}
                roomId={roomId}
              />
              <AnimatePresence initial={false}>
                {others.map((o) => {
                  const peer = peerById.get(o.user_id);
                  return (
                    <motion.div key={o.user_id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
                      <SpeakerRow
                        userId={o.user_id}
                        speaking={!!peer?.speaking}
                        muted={false}
                        displayName={o.profile?.display_name || o.profile?.username || "Anon"}
                        avatarUrl={o.profile?.avatar_url ?? null}
                        username={o.profile?.username ?? null}
                        onOpenWork={onOpenWork}
                        roomId={roomId}
                      />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </ul>
          </div>

          {m.error && <p className="text-xs text-destructive">{m.error}</p>}
        </div>
      )}
    </section>
  );
}

function ViewPill({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition",
        active ? "bg-background text-ink shadow-sm" : "text-ink-muted hover:text-ink",
      )}
    >
      {icon} {label}
    </button>
  );
}

export function VideoStage({
  m,
  meDisplay,
  meAvatar = null,
  profileLookup,
}: {
  m: MediaState;
  meDisplay: string;
  meAvatar?: string | null;
  profileLookup: Map<string, ProfileLite>;
  /** Deprecated: parent now owns the persistent expand button. */
  onEnterFullscreen?: () => void;
}) {

  const videoPeers = m.peers.filter((p) => p.mode === "video" && p.stream);
  const audioPeers = m.peers.filter((p) => !(p.mode === "video" && p.stream));
  const showLocalVideo = m.cameraOn && m.localStream;
  const showLocalAudio = m.joined && !m.cameraOn;
  const sharerName = m.screenSharerId
    ? (profileLookup.get(m.screenSharerId)?.display_name
       ?? profileLookup.get(m.screenSharerId)?.username
       ?? (m.screenSharerId === (m as any).myId ? "You" : "Someone"))
    : null;
  const localScreen = m.isScreenSharing && m.screenStream;
  // When a remote peer is sharing, their video tile is already showing the screen
  // (we replaceTrack'd on their end). We just highlight it with a bigger frame.
  const remoteSharingPeer = m.screenSharerId && !m.isScreenSharing
    ? videoPeers.find((p) => p.userId === m.screenSharerId)
    : null;
  const hasAny =
    showLocalVideo || showLocalAudio || videoPeers.length > 0 || audioPeers.length > 0 || localScreen;
  if (!hasAny) return null;


  const renderAudioPeerTile = (p: (typeof m.peers)[number]) => {
    const prof = profileLookup.get(p.userId);
    const name = prof?.display_name || prof?.username || "Anon";
    return (
      <AudioTile
        key={`audio-${p.userId}`}
        displayName={name}
        avatarUrl={prof?.avatar_url ?? null}
        speaking={!!p.speaking}
        muted={false}
      />
    );
  };

  const localAudioTile = showLocalAudio ? (
    <AudioTile
      key="me-audio"
      displayName={`${meDisplay} (you)`}
      avatarUrl={meAvatar}
      speaking={m.speaking && !m.muted}
      muted={m.muted}
    />
  ) : null;

  // SPOTLIGHT MODE — when anyone's sharing a screen, it dominates the stage and
  // participants shrink to a thumbnail strip below.
  const sharing = !!(localScreen || (m.screenSharerId && !m.isScreenSharing && m.peers.find((p) => p.userId === m.screenSharerId && p.stream)));
  if (sharing) {
    const remotePeer = !localScreen && m.screenSharerId
      ? m.peers.find((p) => p.userId === m.screenSharerId && p.stream)
      : null;
    const spotlightStream = (localScreen ? m.screenStream : remotePeer!.stream) as MediaStream;
    const sourceLabel = screenSourceLabel(spotlightStream);
    const spotlightLabel = localScreen
      ? `Your screen${sourceLabel ? ` — ${sourceLabel}` : ""}`
      : `${sharerName}'s screen${sourceLabel ? ` — ${sourceLabel}` : ""}`;
    // Keep the full participant grid below the spotlight so the local cam tile
    // and remote cam tiles stay visible while someone is sharing. For a REMOTE
    // sharer we hide their cam tile (their video track is already the screen).
    const gridPeers = localScreen ? videoPeers : videoPeers.filter((p) => p.userId !== m.screenSharerId);
    const gridAudioPeers = localScreen
      ? audioPeers
      : audioPeers.filter((p) => p.userId !== m.screenSharerId);
    return (
      <div className="relative border-b border-border bg-ink/95 px-4 py-3 md:px-6 space-y-3">
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[11px] text-background/70">
            <MonitorPlay className="h-3 w-3 text-primary" />
            <span>{localScreen ? `You're sharing${sourceLabel ? ` — ${sourceLabel}` : " your screen"}` : `${sharerName} is sharing${sourceLabel ? ` — ${sourceLabel}` : " their screen"}`}</span>
          </div>
          <div className="overflow-hidden rounded-2xl ring-2 ring-primary/40 bg-black">
            <SpotlightVideo stream={spotlightStream} label={spotlightLabel} muted={!!localScreen} />
          </div>
        </div>
        {(showLocalVideo || showLocalAudio || gridPeers.length > 0 || gridAudioPeers.length > 0) && (
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
            {showLocalVideo && (
              <VideoTile stream={m.localStream!} label={`${meDisplay} (you)`} muted speaking={m.speaking && !m.muted} mirrored />
            )}
            {localAudioTile}
            {gridPeers.map((p) => {
              const prof = profileLookup.get(p.userId);
              return (
                <VideoTile
                  key={p.userId}
                  stream={p.stream!}
                  label={prof?.display_name || prof?.username || "Anon"}
                  speaking={p.speaking}
                />
              );
            })}
            {gridAudioPeers.map(renderAudioPeerTile)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative border-b border-border bg-ink/5 px-4 py-3 md:px-6">
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
        {showLocalVideo && (
          <VideoTile stream={m.localStream!} label={`${meDisplay} (you)`} muted speaking={m.speaking && !m.muted} mirrored />
        )}
        {localAudioTile}
        {videoPeers.map((p) => {
          const prof = profileLookup.get(p.userId);
          return (
            <VideoTile
              key={p.userId}
              stream={p.stream!}
              label={prof?.display_name || prof?.username || "Anon"}
              speaking={p.speaking}
            />
          );
        })}
        {audioPeers.map(renderAudioPeerTile)}
      </div>
    </div>
  );
}


/** Large-format video used for the screen-share spotlight. Uses object-contain
 *  so slides/code aren't cropped, and a tall max-height so it dominates. */
function SpotlightVideo({ stream, label, muted }: { stream: MediaStream; label: string; muted?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
      ref.current.play().catch(() => {});
    }
  }, [stream]);
  return (
    <div className="relative w-full" style={{ aspectRatio: "16 / 9", maxHeight: "70vh" }}>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className="absolute inset-0 h-full w-full object-contain bg-black"
      />
      <div className="absolute bottom-2 left-2 rounded-full bg-ink/70 px-2.5 py-1 text-[11px] text-background">
        {label}
      </div>
    </div>
  );
}


// ============================================================================
// Fullscreen room — unified tile grid (video + audio-only avatars) + chat
// ============================================================================

export function FullscreenRoom({
  m,
  channelTitle,
  meDisplay,
  meAvatar,
  meUserId,
  others,
  profileLookup,
  messages,
  draft,
  setDraft,
  onSend,
  sending,
  onExit,
  onMinimize,
  roomId,
  stageSlot,
  dockExtra,
}: {
  m: MediaState;
  channelTitle: string;
  meDisplay: string;
  meAvatar: string | null;
  meUserId: string;
  others: PresenceLite[];
  profileLookup: Map<string, ProfileLite>;
  messages: FullscreenMessage[];
  draft: string;
  setDraft: (s: string) => void;
  onSend: (e: React.FormEvent) => void;
  sending: boolean;
  onExit: () => void;
  onMinimize: () => void;
  /** Optional room id used for the reactions broadcast channel. */
  roomId?: string;
  /** Optional content for the "Stage" surface — e.g. the active workshop tool. */
  stageSlot?: React.ReactNode;
  /** Extra control (e.g. "New") rendered in the floating dock. */
  dockExtra?: React.ReactNode;
}) {
  const peerById = new Map(m.peers.map((p) => [p.userId, p] as const));
  const totalHere = 1 + others.length;
  const showLocalVideo = m.cameraOn && m.localStream;

  // Lock body scroll while fullscreen.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Mobile chat sheet toggle.
  const [chatOpen, setChatOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // ── Stage source: local screen, peer screen, or stageSlot (active tool) ──
  const remoteSharer = useMemo(
    () => (m.screenSharerId ? m.peers.find((p) => p.userId === m.screenSharerId && p.stream) : null),
    [m.screenSharerId, m.peers],
  );
  const sharerName = m.screenSharerId
    ? (m.isScreenSharing
        ? "You"
        : profileLookup.get(m.screenSharerId)?.display_name
          ?? profileLookup.get(m.screenSharerId)?.username
          ?? "Someone")
    : null;
  const hasShare = !!(m.isScreenSharing && m.screenStream) || !!remoteSharer;
  const stageHasContent = hasShare || !!stageSlot;

  // ── Layout mode: stage (split), grid (legacy tiles), tool (just the surface) ──
  type LayoutMode = "stage" | "grid" | "tool";
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(stageHasContent ? "stage" : "grid");
  // Auto-switch back to grid the moment stage has nothing to show.
  useEffect(() => {
    if (!stageHasContent && layoutMode !== "grid") setLayoutMode("grid");
    else if (stageHasContent && layoutMode === "grid" && hasShare) setLayoutMode("stage");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageHasContent, hasShare]);

  // ── Reactions: lightweight broadcast over a per-room channel. ──
  type Reaction = { id: string; emoji: string; from: string; ts: number };
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const reactionChanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  useEffect(() => {
    if (!roomId) return;
    const ch = supabase.channel(`reactions:${roomId}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "react" }, (msg) => {
      const p = msg.payload as { emoji?: string; from?: string };
      if (!p?.emoji) return;
      const r: Reaction = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, emoji: p.emoji, from: p.from || "Someone", ts: Date.now() };
      setReactions((prev) => [...prev, r]);
      window.setTimeout(() => setReactions((prev) => prev.filter((x) => x.id !== r.id)), 1800);
    });
    ch.subscribe();
    reactionChanRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      reactionChanRef.current = null;
    };
  }, [roomId]);
  function fireReaction(emoji: string) {
    const r: Reaction = { id: `${Date.now()}-me`, emoji, from: meDisplay, ts: Date.now() };
    setReactions((prev) => [...prev, r]);
    window.setTimeout(() => setReactions((prev) => prev.filter((x) => x.id !== r.id)), 1800);
    reactionChanRef.current?.send({ type: "broadcast", event: "react", payload: { emoji, from: meDisplay } }).catch(() => {});
  }

  type Tile =
    | { kind: "me-video"; key: string }
    | { kind: "me-audio"; key: string }
    | { kind: "peer-video"; key: string; peer: MediaPeer; profile?: ProfileLite }
    | { kind: "peer-audio"; key: string; userId: string; profile?: ProfileLite; speaking: boolean };

  const tiles: Tile[] = [];
  tiles.push(
    showLocalVideo
      ? { kind: "me-video", key: "me" }
      : { kind: "me-audio", key: "me" },
  );
  for (const o of others) {
    const peer = peerById.get(o.user_id);
    const prof = profileLookup.get(o.user_id) ?? (o.profile ? {
      user_id: o.user_id,
      display_name: o.profile.display_name,
      username: o.profile.username,
      avatar_url: o.profile.avatar_url,
    } : undefined);
    // In stage layout, hide the remote sharer's camera tile — their tile *is* the stage.
    if (layoutMode !== "grid" && remoteSharer && peer?.userId === remoteSharer.userId) continue;
    if (peer && peer.mode === "video" && peer.stream) {
      tiles.push({ kind: "peer-video", key: o.user_id, peer, profile: prof });
    } else {
      tiles.push({
        kind: "peer-audio",
        key: o.user_id,
        userId: o.user_id,
        profile: prof,
        speaking: !!peer?.speaking,
      });
    }
  }

  // Grid columns scale with participant count, capped tastefully.
  const gridCols =
    tiles.length <= 1 ? "grid-cols-1" :
    tiles.length === 2 ? "grid-cols-1 sm:grid-cols-2" :
    tiles.length <= 4 ? "grid-cols-2 lg:grid-cols-2" :
    "grid-cols-2 lg:grid-cols-3";

  function renderTile(t: Tile) {
    if (t.kind === "me-video") {
      return (
        <VideoTile
          key={t.key}
          stream={m.localStream!}
          label={`${meDisplay} (you)`}
          muted
          speaking={m.speaking && !m.muted}
          mirrored
        />
      );
    }
    if (t.kind === "me-audio") {
      return (
        <AudioTile
          key={t.key}
          displayName={`${meDisplay} (you)`}
          avatarUrl={meAvatar}
          speaking={m.speaking && !m.muted}
          muted={m.muted}
        />
      );
    }
    if (t.kind === "peer-video") {
      return (
        <VideoTile
          key={t.key}
          stream={t.peer.stream!}
          label={t.profile?.display_name || t.profile?.username || "Anon"}
          speaking={t.peer.speaking}
        />
      );
    }
    return (
      <AudioTile
        key={t.key}
        displayName={t.profile?.display_name || t.profile?.username || "Anon"}
        avatarUrl={t.profile?.avatar_url ?? null}
        speaking={t.speaking}
        muted={false}
      />
    );
  }

  const stageStream: MediaStream | null = m.isScreenSharing
    ? (m.screenStream ?? null)
    : (remoteSharer?.stream ?? null);
  const stageSourceLabel = screenSourceLabel(stageStream);
  const stageLabel = m.isScreenSharing
    ? `Your screen${stageSourceLabel ? ` — ${stageSourceLabel}` : ""}`
    : (remoteSharer ? `${sharerName}'s screen${stageSourceLabel ? ` — ${stageSourceLabel}` : ""}` : null);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-[#0a0a0a] text-background"
    >
      {/* Top bar */}
      <header className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative inline-flex h-2 w-2 shrink-0">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <h2 className="text-xs font-medium uppercase tracking-wider text-background/70 truncate">
            {channelTitle}
          </h2>
          <span className="rounded-full bg-background/10 px-2 py-0.5 text-[11px] text-background/70 shrink-0">
            {totalHere}/{m.cap}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Layout segmented control — only when stage has something to show */}
          {stageHasContent && (
            <div className="hidden sm:flex items-center gap-0.5 rounded-full bg-background/10 p-0.5">
              <LayoutSeg active={layoutMode === "stage"} onClick={() => setLayoutMode("stage")} icon={<MonitorPlay className="h-3.5 w-3.5" />} label="Stage" />
              <LayoutSeg active={layoutMode === "grid"} onClick={() => setLayoutMode("grid")} icon={<LayoutGrid className="h-3.5 w-3.5" />} label="Grid" />
              <LayoutSeg active={layoutMode === "tool"} onClick={() => setLayoutMode("tool")} icon={<Maximize2 className="h-3.5 w-3.5" />} label="Tool" />
            </div>
          )}
          <button
            type="button"
            onClick={() => setChatOpen((v) => !v)}
            className="lg:hidden inline-flex items-center gap-1.5 rounded-full bg-background/10 px-3 py-1.5 text-xs text-background/90 hover:bg-background/15"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Chat {messages.length > 0 && `(${messages.length})`}
          </button>
          <button
            type="button"
            onClick={onMinimize}
            className="rounded-full bg-background/10 p-2 text-background/90 hover:bg-background/15"
            aria-label="Exit fullscreen"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main: stage/tiles + chat */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 px-4 pb-28 md:px-6">
        <div className="min-h-0 overflow-auto">
          {(layoutMode === "stage" || layoutMode === "tool") && stageHasContent ? (
            <div className="flex h-full flex-col gap-3">
              {/* Stage surface */}
              <div className="flex-1 min-h-0 overflow-hidden rounded-2xl ring-1 ring-background/10 bg-black">
                {stageStream ? (
                  <SpotlightVideo stream={stageStream} label={stageLabel || "Stage"} muted={m.isScreenSharing} />
                ) : (
                  <div className="h-full w-full overflow-auto bg-[#111]">{stageSlot}</div>
                )}
              </div>
              {/* Filmstrip — hidden in Tool-only */}
              {layoutMode === "stage" && (
                <div className="shrink-0 overflow-x-auto">
                  <div className="flex gap-2 pb-1">
                    {tiles.map((t) => (
                      <div key={t.key} className="w-40 shrink-0">
                        {renderTile(t)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="w-full max-w-6xl">
                <div className={cn("grid gap-3", gridCols)}>
                  {tiles.map(renderTile)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chat — desktop side panel */}
        <ChatPanel
          messages={messages}
          draft={draft}
          setDraft={setDraft}
          onSend={onSend}
          sending={sending}
          profileLookup={profileLookup}
          meUserId={meUserId}
          scrollRef={scrollRef}
          className="hidden lg:flex"
        />
      </div>

      {/* Floating reactions overlay */}
      <ReactionsOverlay reactions={reactions} />


      {/* Mobile chat sheet */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="lg:hidden fixed inset-x-0 bottom-0 z-[60] h-[70vh] rounded-t-3xl border-t border-background/10 bg-[#0a0a0a]/95 backdrop-blur p-4 pb-6"
          >
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-background/20" />
            <ChatPanel
              messages={messages}
              draft={draft}
              setDraft={setDraft}
              onSend={onSend}
              sending={sending}
              profileLookup={profileLookup}
              meUserId={meUserId}
              scrollRef={scrollRef}
              className="flex h-full"
              onClose={() => setChatOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reactions tray */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[55] flex items-center gap-1 rounded-full border border-background/15 bg-background/5 backdrop-blur-md px-2 py-1.5">
        {["👏","🔥","💡","❤️","❓"].map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => fireReaction(e)}
            className="rounded-full px-2 py-1 text-base leading-none transition hover:scale-125 hover:bg-background/10"
            title={`Send ${e}`}
          >
            {e}
          </button>
        ))}
      </div>

      {/* Floating control dock */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[55] flex items-center gap-2 rounded-full border border-background/15 bg-background/10 backdrop-blur-md px-2 py-2 shadow-2xl"
      >
        <DockButton onClick={m.toggleMute} active={!m.muted}>
          {m.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          <span className="hidden sm:inline">{m.muted ? "Unmute" : "Mute"}</span>
        </DockButton>
        <DockButton onClick={() => m.setCameraEnabled(!m.cameraOn)} active={m.cameraOn} disabled={m.busy}>
          {m.cameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          <span className="hidden sm:inline">{m.cameraOn ? "Camera off" : "Camera on"}</span>
        </DockButton>
        {dockExtra && (
          <div className="inline-flex [&_button]:rounded-full">{dockExtra}</div>
        )}
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-1.5 rounded-full bg-destructive/90 hover:bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Exit</span>
        </button>
      </motion.div>
    </motion.div>
  );
}

function LayoutSeg({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition",
        active ? "bg-background text-ink" : "text-background/80 hover:bg-background/10",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ReactionsOverlay({ reactions }: { reactions: Array<{ id: string; emoji: string; from: string }> }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-40 z-[56] flex justify-center">
      <div className="relative h-32 w-full max-w-3xl">
        <AnimatePresence>
          {reactions.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 0, scale: 0.6, x: (i % 5 - 2) * 60 }}
              animate={{ opacity: 1, y: -80, scale: 1 }}
              exit={{ opacity: 0, y: -120, scale: 0.8 }}
              transition={{ duration: 1.6, ease: "easeOut" }}
              className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center"
            >
              <span className="text-4xl drop-shadow-lg">{r.emoji}</span>
              <span className="mt-1 rounded-full bg-ink/70 px-2 py-0.5 text-[10px] text-background/90">{r.from}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}


function DockButton({
  children, onClick, active, disabled,
}: { children: React.ReactNode; onClick: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition disabled:opacity-50",
        active
          ? "bg-background/90 text-ink hover:bg-background"
          : "bg-background/10 text-background/90 hover:bg-background/20",
      )}
    >
      {children}
    </button>
  );
}

function ChatPanel({
  messages, draft, setDraft, onSend, sending, profileLookup, meUserId, scrollRef, className, onClose,
}: {
  messages: FullscreenMessage[];
  draft: string;
  setDraft: (s: string) => void;
  onSend: (e: React.FormEvent) => void;
  sending: boolean;
  profileLookup: Map<string, ProfileLite>;
  meUserId: string;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
  onClose?: () => void;
}) {
  return (
    <div className={cn("flex-col rounded-2xl border border-background/10 bg-background/[0.04] backdrop-blur overflow-hidden", className)}>
      <div className="flex items-center justify-between border-b border-background/10 px-4 py-2.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-background/60">Chat</span>
        {onClose && (
          <button onClick={onClose} className="text-xs text-background/60 hover:text-background">Close</button>
        )}
      </div>
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2">
        {messages.length === 0 ? (
          <p className="mt-6 text-center text-xs text-background/50">Quiet in here. Say hi.</p>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const prof = profileLookup.get(msg.user_id);
              const mine = msg.user_id === meUserId;
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn("flex gap-2", mine && "flex-row-reverse")}
                >
                  <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-background/10 text-[10px] flex items-center justify-center text-background/70">
                    {prof?.avatar_url
                      ? <img src={prof.avatar_url} alt="" className="h-full w-full object-cover" />
                      : (prof?.display_name?.[0]?.toUpperCase() || "?")}
                  </div>
                  <div className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-1.5 text-sm",
                    mine ? "gradient-motion text-primary-foreground" : "bg-background/10 text-background",
                  )}>
                    {!mine && prof && (
                      <div className="text-[10px] font-medium opacity-60 mb-0.5">{prof.display_name || prof.username}</div>
                    )}
                    <div className="whitespace-pre-wrap break-words">{msg.body}</div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
      <form onSubmit={onSend} className="flex items-center gap-2 border-t border-background/10 p-2.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Say something…"
          maxLength={1000}
          className="bg-background/10 border-background/10 text-background placeholder:text-background/40"
        />
        <Button type="submit" size="icon" className="rounded-full shrink-0" disabled={!draft.trim() || sending} aria-label="Send message">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

function SpeakerRow({
  userId, speaking, muted, displayName, avatarUrl, username, isMe, onOpenWork, roomId,
}: {
  userId: string;
  speaking: boolean;
  muted: boolean;
  displayName: string;
  avatarUrl: string | null;
  username: string | null;
  isMe?: boolean;
  onOpenWork?: (workId: string) => void;
  roomId?: string;
}) {
  const inner = (
    <button type="button" className="flex w-full items-center gap-2 rounded-lg px-1 py-0.5 -mx-1 text-left hover:bg-muted/60 transition">
      <div className={cn(
        "relative h-8 w-8 shrink-0 rounded-full overflow-hidden bg-muted text-[10px] flex items-center justify-center text-ink-muted ring-2 transition",
        speaking ? "ring-[3px] ring-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.25)]" : "ring-transparent",
      )}>

        {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : displayName[0]?.toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <span className="block text-sm text-ink truncate">{displayName}{isMe ? " (you)" : ""}</span>
        {username && <span className="block text-[10px] text-ink-muted truncate">@{username}</span>}
      </div>
      {muted && <MicOff className="h-3.5 w-3.5 text-ink-muted" />}
    </button>
  );
  return (
    <li>
      <ProfilePeek userId={userId} speaking={speaking} onWorkClick={onOpenWork} roomId={roomId}>
        {inner}
      </ProfilePeek>
    </li>
  );
}

export function VideoTile({
  stream, label, muted, speaking, mirrored,
}: { stream: MediaStream; label: string; muted?: boolean; speaking?: boolean; mirrored?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
      ref.current.play().catch(() => {});
    }
  }, [stream]);
  return (
    <div className={cn(
      "relative aspect-video overflow-hidden rounded-2xl bg-ink ring-2 transition",
      speaking ? "ring-[3px] ring-primary" : "ring-transparent",
    )}>
      {speaking && (
        <span className="pointer-events-none absolute inset-0 rounded-2xl ring-4 ring-primary/30 animate-pulse" />
      )}
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={cn("h-full w-full object-cover", mirrored && "scale-x-[-1]")}
      />
      <div className="absolute bottom-2 left-2 rounded-full bg-ink/70 px-2 py-0.5 text-[11px] text-background truncate max-w-[90%]">
        {label}
      </div>
    </div>
  );
}


export function AudioTile({
  displayName, avatarUrl, speaking, muted,
}: { displayName: string; avatarUrl: string | null; speaking: boolean; muted: boolean }) {
  return (
    <div className={cn(
      "relative aspect-video overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] ring-2 transition flex items-center justify-center",
      speaking ? "ring-[3px] ring-primary" : "ring-background/10",
    )}>
      {speaking && (
        <span className="pointer-events-none absolute inset-0 rounded-2xl ring-4 ring-primary/30 animate-pulse" />
      )}

      <div className={cn(
        "relative h-20 w-20 rounded-full overflow-hidden bg-background/10 text-2xl font-medium flex items-center justify-center text-background/80 ring-2 ring-offset-2 ring-offset-[#0a0a0a] transition",
        speaking ? "ring-primary" : "ring-background/15",
      )}>
        {avatarUrl
          ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          : displayName[0]?.toUpperCase()}
        {speaking && (
          <span className="absolute inset-0 rounded-full ring-4 ring-primary/40 animate-pulse" />
        )}
      </div>
      <div className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-ink/70 px-2 py-0.5 text-[11px] text-background truncate max-w-[90%]">
        {muted && <MicOff className="h-3 w-3" />}
        <span className="truncate">{displayName}</span>
      </div>
    </div>
  );
}

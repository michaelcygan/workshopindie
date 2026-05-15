import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, LogOut, Radio, Maximize2, Minimize2, Send, MessageSquare, MessageCircle, LayoutGrid, PenLine } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ProfilePeek } from "@/components/profile-peek";
import type { useMediaRoom, MediaPeer } from "@/hooks/use-media-room";

export type RoomViewMode = "chat" | "gallery" | "whiteboard";

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
}) {
  const totalHere = 1 + others.length;
  const peerById = new Map(m.peers.map((p) => [p.userId, p]));
  return (
    <section className="rounded-3xl border border-border bg-surface p-4 shadow-soft">
      <header className="flex items-center gap-2">
        <Radio className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-medium uppercase tracking-wide text-ink-muted">
          {channelTitle}
        </h3>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-ink-soft">
          {totalHere}/{m.cap}
        </span>
      </header>

      {viewMode && onViewModeChange && (
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-full bg-muted p-1">
          <ViewPill active={viewMode === "chat"} onClick={() => onViewModeChange("chat")} icon={<MessageCircle className="h-3.5 w-3.5" />} label="Chat" />
          <ViewPill active={viewMode === "gallery"} onClick={() => onViewModeChange("gallery")} icon={<LayoutGrid className="h-3.5 w-3.5" />} label="Gallery" />
          <ViewPill active={viewMode === "whiteboard"} onClick={() => onViewModeChange("whiteboard")} icon={<PenLine className="h-3.5 w-3.5" />} label="Board" />
        </div>
      )}

      {!m.joined ? (
        <p className="mt-3 text-xs text-ink-muted">
          {m.busy ? "Connecting…" : "Joining the room…"}
          {m.error && <span className="block mt-1 text-destructive">{m.error}</span>}
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={m.muted ? "outline" : "secondary"}
              size="sm"
              onClick={m.toggleMute}
              className="rounded-full gap-1.5"
            >
              {m.muted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              {m.muted ? "Unmute" : "Mute"}
            </Button>
            <Button
              variant={m.cameraOn ? "secondary" : "outline"}
              size="sm"
              onClick={() => m.setCameraEnabled(!m.cameraOn)}
              disabled={m.busy}
              className="rounded-full gap-1.5"
            >
              {m.cameraOn ? <Video className="h-3.5 w-3.5" /> : <VideoOff className="h-3.5 w-3.5" />}
              {m.cameraOn ? "Camera off" : "Camera on"}
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onExit}
            className="w-full rounded-full gap-1.5 text-destructive hover:text-destructive"
          >
            <LogOut className="h-3.5 w-3.5" /> Exit Lounge
          </Button>

          <div className="border-t border-border pt-3">
            <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
              In the room · {totalHere}
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

export function VideoStage({
  m,
  meDisplay,
  profileLookup,
  onEnterFullscreen,
}: {
  m: MediaState;
  meDisplay: string;
  profileLookup: Map<string, ProfileLite>;
  onEnterFullscreen?: () => void;
}) {
  const videoPeers = m.peers.filter((p) => p.mode === "video" && p.stream);
  const showLocalVideo = m.cameraOn && m.localStream;
  const hasAny = showLocalVideo || videoPeers.length > 0;
  if (!hasAny) return null;

  return (
    <div className="relative border-b border-border bg-ink/5 px-4 py-3 md:px-6">
      {onEnterFullscreen && (
        <button
          type="button"
          onClick={onEnterFullscreen}
          className="absolute right-3 top-3 z-10 rounded-full bg-background/80 p-1.5 text-ink shadow-sm hover:bg-background"
          aria-label="Enter fullscreen"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      )}
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
        {showLocalVideo && (
          <VideoTile stream={m.localStream!} label={`${meDisplay} (you)`} muted speaking={m.speaking && !m.muted} mirrored />
        )}
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-[#0a0a0a] text-background"
    >
      {/* Top bar */}
      <header className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
        <div className="flex items-center gap-2">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <h2 className="text-xs font-medium uppercase tracking-wider text-background/70">
            {channelTitle}
          </h2>
          <span className="rounded-full bg-background/10 px-2 py-0.5 text-[11px] text-background/70">
            {totalHere}/{m.cap}
          </span>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Main: tiles + chat */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 px-4 pb-28 md:px-6">
        <div className="min-h-0 overflow-auto flex items-center justify-center">
          <div className="w-full max-w-6xl">
            <div className={cn("grid gap-3", gridCols)}>
              {tiles.map((t) => {
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
              })}
            </div>
          </div>
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
                    mine ? "bg-primary text-primary-foreground" : "bg-background/10 text-background",
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
        <Button type="submit" size="icon" className="rounded-full shrink-0" disabled={!draft.trim() || sending}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

function SpeakerRow({
  userId, speaking, muted, displayName, avatarUrl, username, isMe, onOpenWork,
}: {
  userId: string;
  speaking: boolean;
  muted: boolean;
  displayName: string;
  avatarUrl: string | null;
  username: string | null;
  isMe?: boolean;
  onOpenWork?: (workId: string) => void;
}) {
  const inner = (
    <button type="button" className="flex w-full items-center gap-2 rounded-lg px-1 py-0.5 -mx-1 text-left hover:bg-muted/60 transition">
      <div className={cn(
        "relative h-8 w-8 shrink-0 rounded-full overflow-hidden bg-muted text-[10px] flex items-center justify-center text-ink-muted ring-2 transition",
        speaking ? "ring-primary" : "ring-transparent",
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
      <ProfilePeek userId={userId} speaking={speaking} onWorkClick={onOpenWork}>
        {inner}
      </ProfilePeek>
    </li>
  );
}

function VideoTile({
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
      speaking ? "ring-primary" : "ring-transparent",
    )}>
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

function AudioTile({
  displayName, avatarUrl, speaking, muted,
}: { displayName: string; avatarUrl: string | null; speaking: boolean; muted: boolean }) {
  return (
    <div className={cn(
      "relative aspect-video overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] ring-2 transition flex items-center justify-center",
      speaking ? "ring-primary" : "ring-background/10",
    )}>
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

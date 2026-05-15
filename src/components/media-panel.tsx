import { useEffect, useRef } from "react";
import { Mic, MicOff, Video, PhoneOff, Radio, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MediaPeer, useMediaRoom } from "@/hooks/use-media-room";

export type MediaState = ReturnType<typeof useMediaRoom>;

export type ProfileLite = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export function MediaPanel({
  m,
  channelTitle,
  meDisplay,
  meAvatar,
  profileLookup,
}: {
  m: MediaState;
  channelTitle: string;
  meDisplay: string;
  meAvatar: string | null;
  profileLookup: Map<string, ProfileLite>;
}) {
  return (
    <section className="rounded-3xl border border-border bg-surface p-4 shadow-soft">
      <header className="flex items-center gap-2">
        <Radio className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-medium uppercase tracking-wide text-ink-muted">
          Live · {channelTitle}
        </h3>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-ink-soft">
          {m.voiceCount}/{m.cap}
        </span>
      </header>

      {!m.joined ? (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-ink-muted">
            {m.voiceCount === 0
              ? "Quiet right now. Drop in to start."
              : `${m.voiceCount} ${m.voiceCount === 1 ? "person" : "people"} live${m.videoCount ? ` · ${m.videoCount} on cam` : ""}.`}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <ModeButton icon={Mic} label="Voice" onClick={() => m.setMode("voice")} disabled={m.busy || m.voiceCount >= m.cap} primary />
            <ModeButton icon={Video} label="Video" onClick={() => m.setMode("video")} disabled={m.busy || m.voiceCount >= m.cap || m.videoCount >= m.videoCap} />
          </div>
          <p className="text-[11px] text-ink-muted">Mic or camera required to join.</p>
          {m.busy && (
            <p className="text-xs text-ink-muted inline-flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Connecting…
            </p>
          )}
          {m.error && <p className="text-xs text-destructive">{m.error}</p>}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
            <ModeChip active={m.mode === "voice"} icon={Mic} label="Voice" onClick={() => m.setMode("voice")} disabled={m.busy} />
            <ModeChip active={m.mode === "video"} icon={Video} label="Video" onClick={() => m.setMode("video")} disabled={m.busy || (m.mode !== "video" && m.videoCount >= m.videoCap)} />
          </div>

          <ul className="space-y-2">
            <SpeakerRow
              key="me"
              speaking={m.speaking && !m.muted}
              muted={m.muted}
              displayName={meDisplay}
              avatarUrl={meAvatar}
              username={null}
              isMe
            />
            <AnimatePresence initial={false}>
              {m.peers.map((p: MediaPeer) => {
                const prof = profileLookup.get(p.userId);
                return (
                  <motion.div key={p.userId} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
                    <SpeakerRow
                      speaking={p.speaking}
                      muted={false}
                      displayName={prof?.display_name || prof?.username || "Anon"}
                      avatarUrl={prof?.avatar_url ?? null}
                      username={prof?.username ?? null}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </ul>

          <div className="flex gap-2">
            <Button variant={m.muted ? "outline" : "secondary"} size="sm" onClick={m.toggleMute} className="flex-1 rounded-full gap-1.5">
              {m.muted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              {m.muted ? "Unmute" : "Mute"}
            </Button>
            <Button variant="outline" size="sm" onClick={m.leave} className="flex-1 rounded-full gap-1.5 text-destructive hover:text-destructive">
              <PhoneOff className="h-3.5 w-3.5" /> Leave
            </Button>
          </div>
          {m.error && <p className="text-xs text-destructive">{m.error}</p>}
        </div>
      )}
    </section>
  );
}

/**
 * Renders the active video grid (local + remote video peers). When nobody
 * is on camera, renders nothing — chat alone fills the stage.
 */
export function VideoStage({
  m,
  meDisplay,
  profileLookup,
}: {
  m: MediaState;
  meDisplay: string;
  profileLookup: Map<string, ProfileLite>;
}) {
  const videoPeers = m.peers.filter((p) => p.mode === "video" && p.stream);
  const showLocalVideo = m.mode === "video" && m.localStream;
  if (!showLocalVideo && videoPeers.length === 0) return null;
  const total = (showLocalVideo ? 1 : 0) + videoPeers.length;
  const cols = total <= 1 ? "grid-cols-1" : total === 2 ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3";
  return (
    <div className="border-b border-border bg-ink/5 px-4 py-3 md:px-6">
      <div className={cn("grid gap-2", cols)}>
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

function ModeButton({
  icon: Icon, label, onClick, disabled, primary,
}: { icon: typeof Mic; label: string; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      variant={primary ? "default" : "outline"}
      size="sm"
      className="rounded-full flex-col h-auto py-2 gap-1"
    >
      <Icon className="h-4 w-4" />
      <span className="text-[10px] font-medium">{label}</span>
    </Button>
  );
}

function ModeChip({
  active, icon: Icon, label, onClick, disabled,
}: { active: boolean; icon: typeof Mic; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-full px-2 py-1 text-[11px] inline-flex items-center justify-center gap-1 transition",
        active ? "bg-ink text-background" : "text-ink-soft hover:bg-background/50",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}

function SpeakerRow({
  speaking, muted, displayName, avatarUrl, username, isMe,
}: {
  speaking: boolean;
  muted: boolean;
  displayName: string;
  avatarUrl: string | null;
  username: string | null;
  isMe?: boolean;
}) {
  return (
    <li className="flex items-center gap-2">
      <div className={cn(
        "relative h-8 w-8 shrink-0 rounded-full overflow-hidden bg-muted text-[10px] flex items-center justify-center text-ink-muted ring-2 transition",
        speaking ? "ring-primary" : "ring-transparent",
      )}>
        {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : displayName[0]?.toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        {username && !isMe ? (
          <Link to="/u/$username" params={{ username }} className="block text-sm text-ink hover:underline truncate">
            {displayName}
          </Link>
        ) : (
          <span className="block text-sm text-ink truncate">{displayName}{isMe ? " (you)" : ""}</span>
        )}
      </div>
      {muted && <MicOff className="h-3.5 w-3.5 text-ink-muted" />}
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
      <div className="absolute bottom-1 left-1 rounded-full bg-ink/70 px-1.5 py-0.5 text-[10px] text-background truncate max-w-[90%]">
        {label}
      </div>
    </div>
  );
}

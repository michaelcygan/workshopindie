import { useEffect, useRef } from "react";
import { Mic, MicOff, Video, VideoOff, LogOut, Radio } from "lucide-react";
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

export type PresenceLite = {
  user_id: string;
  profile?: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
};

export function MediaPanel({
  m,
  channelTitle,
  meDisplay,
  meAvatar,
  profileLookup,
  others,
  onExit,
}: {
  m: MediaState;
  channelTitle: string;
  meDisplay: string;
  meAvatar: string | null;
  profileLookup: Map<string, ProfileLite>;
  others: PresenceLite[];
  onExit: () => void;
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
                speaking={m.speaking && !m.muted}
                muted={m.muted}
                displayName={meDisplay}
                avatarUrl={meAvatar}
                username={null}
                isMe
              />
              <AnimatePresence initial={false}>
                {others.map((o) => {
                  const peer = peerById.get(o.user_id);
                  return (
                    <motion.div key={o.user_id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
                      <SpeakerRow
                        speaking={!!peer?.speaking}
                        muted={false}
                        displayName={o.profile?.display_name || o.profile?.username || "Anon"}
                        avatarUrl={o.profile?.avatar_url ?? null}
                        username={o.profile?.username ?? null}
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
}: {
  m: MediaState;
  meDisplay: string;
  profileLookup: Map<string, ProfileLite>;
}) {
  const videoPeers = m.peers.filter((p) => p.mode === "video" && p.stream);
  const showLocalVideo = m.cameraOn && m.localStream;
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

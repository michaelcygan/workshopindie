import { Mic, MicOff, PhoneOff, Radio, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useVoiceRoom } from "@/hooks/use-voice-room";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ProfileLite = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export function VoicePanel({
  roomId,
  channelTitle,
  profileLookup,
}: {
  roomId: string | undefined;
  channelTitle: string;
  profileLookup: Map<string, ProfileLite>;
}) {
  const { user } = useAuth();
  const v = useVoiceRoom(roomId);

  const me = user ? profileLookup.get(user.id) : undefined;
  const meDisplay = me?.display_name || me?.username || "You";

  return (
    <section className="rounded-3xl border border-border bg-surface p-4 shadow-soft">
      <header className="flex items-center gap-2">
        <Radio className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-medium uppercase tracking-wide text-ink-muted">
          Voice · {channelTitle}
        </h3>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-ink-soft">
          {v.count}/{v.cap}
        </span>
      </header>

      {!v.joined ? (
        <div className="mt-3">
          <p className="text-xs text-ink-muted">
            {v.count === 0
              ? "No one's talking yet. Be the first."
              : v.count === 1
                ? "1 person in voice."
                : `${v.count} people in voice.`}
          </p>
          <Button
            onClick={v.join}
            disabled={v.busy || v.count >= v.cap}
            className="mt-3 w-full rounded-full gap-2"
          >
            {v.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
            {v.count >= v.cap ? "Voice full" : v.busy ? "Connecting…" : "Join voice"}
          </Button>
          {v.error && <p className="mt-2 text-xs text-destructive">{v.error}</p>}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <ul className="space-y-2">
            <SpeakerRow
              key="me"
              speaking={v.speaking && !v.muted}
              muted={v.muted}
              displayName={meDisplay}
              avatarUrl={me?.avatar_url ?? null}
              username={me?.username ?? null}
              isMe
            />
            <AnimatePresence initial={false}>
              {v.peers.map((p) => {
                const prof = profileLookup.get(p.userId);
                return (
                  <motion.div
                    key={p.userId}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                  >
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
            <Button
              variant={v.muted ? "outline" : "secondary"}
              size="sm"
              onClick={v.toggleMute}
              className="flex-1 rounded-full gap-1.5"
            >
              {v.muted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              {v.muted ? "Unmute" : "Mute"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={v.leave}
              className="flex-1 rounded-full gap-1.5 text-destructive hover:text-destructive"
            >
              <PhoneOff className="h-3.5 w-3.5" /> Leave
            </Button>
          </div>
          {v.error && <p className="text-xs text-destructive">{v.error}</p>}
        </div>
      )}
    </section>
  );
}

function SpeakerRow({
  speaking,
  muted,
  displayName,
  avatarUrl,
  username,
  isMe,
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
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          displayName[0]?.toUpperCase()
        )}
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

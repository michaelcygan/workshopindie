import { useEffect, useRef, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MediaPanel, VideoStage, FullscreenRoom } from "@/components/media-panel";
import { useMediaRoom, type MediaMode } from "@/hooks/use-media-room";
import { joinLounge } from "@/lib/instant.functions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

type Message = { id: string; user_id: string; body: string; created_at: string };
type Presence = {
  user_id: string;
  last_seen_at: string;
  profile?: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
};

const QUIET_WARN_MS = 2 * 60 * 1000;
const QUIET_KICK_MS = 60 * 1000;

export function ChannelView({
  roomId,
  title,
  pinned,
  initialMode = "voice",
}: {
  roomId: string;
  title: string;
  pinned?: React.ReactNode;
  initialMode?: MediaMode;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [warnOpen, setWarnOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [endedOpen, setEndedOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [joiningNew, setJoiningNew] = useState(false);
  const aloneTimerRef = useRef<number | null>(null);
  const dropNew = useServerFn(joinLounge);
  const scrollRef = useRef<HTMLDivElement>(null);

  const media = useMediaRoom(roomId);

  // Auto-join on mount with the chosen mode (user already pre-flighted permission).
  const autoJoinedRef = useRef(false);
  useEffect(() => {
    if (autoJoinedRef.current) return;
    if (!user || !roomId) return;
    if (media.joined || media.busy) return;
    autoJoinedRef.current = true;
    media.setMode(initialMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, roomId, media.joined, media.busy, initialMode]);

  // If join fails, route back to /instant.
  useEffect(() => {
    if (autoJoinedRef.current && media.error && !media.joined && !media.busy) {
      toast.error(media.error);
      router.navigate({ to: "/instant" });
    }
  }, [media.error, media.joined, media.busy, router]);

  function handleExit() {
    media.leave();
    router.navigate({ to: "/" });
  }

  // Esc exits fullscreen.
  useEffect(() => {
    if (!fullscreen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFullscreen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  // Inactivity guard: muted AND camera off → warn at 2 min, drop 1 min later.
  // Suppressed while the "workshop wrapped" prompt is open.
  const inactive = media.joined && media.muted && !media.cameraOn && !endedOpen;
  useEffect(() => {
    if (!inactive) {
      setWarnOpen(false);
      return;
    }
    const warnT = setTimeout(() => setWarnOpen(true), QUIET_WARN_MS);
    return () => clearTimeout(warnT);
  }, [inactive]);

  useEffect(() => {
    if (!warnOpen) return;
    const kickT = setTimeout(() => {
      if (inactive) {
        toast.error("Dropped from the Lounge — you went quiet.");
        media.leave();
        router.navigate({ to: "/instant" });
      }
    }, QUIET_KICK_MS);
    return () => clearTimeout(kickT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warnOpen, inactive]);

  // "Workshop wrapped" — fire 1s after the user is the only one in the room.
  const alone = media.joined && media.count <= 1;
  useEffect(() => {
    if (!alone) {
      if (aloneTimerRef.current) {
        clearTimeout(aloneTimerRef.current);
        aloneTimerRef.current = null;
      }
      if (endedOpen) {
        setEndedOpen(false);
        setSecondsLeft(30);
      }
      return;
    }
    if (endedOpen || aloneTimerRef.current) return;
    aloneTimerRef.current = window.setTimeout(() => {
      aloneTimerRef.current = null;
      setSecondsLeft(30);
      setEndedOpen(true);
    }, 1000);
    return () => {
      if (aloneTimerRef.current) {
        clearTimeout(aloneTimerRef.current);
        aloneTimerRef.current = null;
      }
    };
  }, [alone, endedOpen]);

  // 30s countdown while the prompt is open → auto-forward to home.
  useEffect(() => {
    if (!endedOpen) return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          handleExit();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endedOpen]);

  async function handleJoinNew() {
    if (joiningNew) return;
    setJoiningNew(true);
    const nextMode: MediaMode = media.cameraOn || media.mode === "video" ? "video" : "voice";
    try {
      media.leave();
      const { roomId: newId } = await dropNew();
      setEndedOpen(false);
      router.navigate({ to: "/instant/$id", params: { id: newId }, search: { mode: nextMode } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't find a new Workshop");
      setJoiningNew(false);
      router.navigate({ to: "/instant" });
    }
  }

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function join() {
      await supabase.from("instant_presence").upsert({
        room_id: roomId, user_id: user!.id, status: "active", last_seen_at: new Date().toISOString(),
      });
      const [msgs, pres] = await Promise.all([
        supabase.from("instant_messages").select("id,user_id,body,created_at").eq("room_id", roomId).order("created_at", { ascending: true }).limit(200),
        supabase.from("instant_presence").select("user_id,last_seen_at,profile:profiles!instant_presence_user_id_fkey(display_name,username,avatar_url)").eq("room_id", roomId),
      ]);
      if (cancelled) return;
      setMessages((msgs.data ?? []) as Message[]);
      setPresence((pres.data ?? []) as unknown as Presence[]);
    }
    join();

    const channel = supabase
      .channel(`instant:${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "instant_messages", filter: `room_id=eq.${roomId}` },
        (p) => setMessages((prev) => [...prev, p.new as Message]))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "instant_presence", filter: `room_id=eq.${roomId}` },
        async (p) => {
          const newRow = p.new as Presence;
          const { data } = await supabase.from("profiles").select("display_name,username,avatar_url").eq("id", newRow.user_id).maybeSingle();
          setPresence((prev) => prev.find((x) => x.user_id === newRow.user_id) ? prev : [...prev, { ...newRow, profile: data }]);
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "instant_presence", filter: `room_id=eq.${roomId}` },
        (p) => setPresence((prev) => prev.filter((x) => x.user_id !== (p.old as Presence).user_id)))
      .subscribe();

    const heartbeat = setInterval(() => {
      supabase.from("instant_presence").update({ last_seen_at: new Date().toISOString() })
        .eq("room_id", roomId).eq("user_id", user.id);
    }, 30_000);

    function leave() {
      supabase.from("instant_presence").delete().eq("room_id", roomId).eq("user_id", user!.id);
    }
    window.addEventListener("beforeunload", leave);

    return () => {
      cancelled = true;
      clearInterval(heartbeat);
      supabase.removeChannel(channel);
      window.removeEventListener("beforeunload", leave);
      leave();
    };
  }, [roomId, user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !draft.trim()) return;
    setSending(true);
    const body = draft.trim().slice(0, 1000);
    setDraft("");
    const { error } = await supabase.from("instant_messages").insert({ room_id: roomId, user_id: user.id, body });
    setSending(false);
    if (error) toast.error(error.message);
  }

  const profileLookup = new Map(
    presence.map((p) => [
      p.user_id,
      {
        user_id: p.user_id,
        display_name: p.profile?.display_name ?? null,
        username: p.profile?.username ?? null,
        avatar_url: p.profile?.avatar_url ?? null,
      },
    ]),
  );

  const me = user ? profileLookup.get(user.id) : undefined;
  const meDisplay = me?.display_name || me?.username || "You";
  const meAvatar = me?.avatar_url ?? null;
  const others = presence.filter((p) => p.user_id !== user?.id);

  return (
    <>
    {fullscreen && user && (
      <FullscreenRoom
        m={media}
        channelTitle={title}
        meDisplay={meDisplay}
        meAvatar={meAvatar}
        meUserId={user.id}
        others={others}
        profileLookup={profileLookup}
        messages={messages}
        draft={draft}
        setDraft={setDraft}
        onSend={send}
        sending={sending}
        onExit={handleExit}
        onMinimize={() => setFullscreen(false)}
      />
    )}
    <div className="mt-6 grid gap-4 md:grid-cols-[1fr_260px]">
      <div className="flex flex-col rounded-3xl border border-border bg-surface shadow-soft overflow-hidden">
        {pinned && (
          <div className="border-b border-border bg-muted/40 px-4 py-3 md:px-6">
            {pinned}
          </div>
        )}
        <VideoStage
          m={media}
          meDisplay={meDisplay}
          profileLookup={profileLookup}
          onEnterFullscreen={() => setFullscreen(true)}
        />
        <div ref={scrollRef} className="h-[60vh] overflow-y-auto px-4 py-4 md:px-6">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center">
              <div>
                <p className="font-display text-xl text-ink">Quiet in {title}.</p>
                <p className="mt-1 text-sm text-ink-muted">Be the first to say hi. Messages vanish after 24h.</p>
              </div>
            </div>
          ) : (
            <ul className="space-y-3">
              <AnimatePresence initial={false}>
                {messages.map((m) => {
                  const p = presence.find((pp) => pp.user_id === m.user_id)?.profile;
                  const mine = m.user_id === user?.id;
                  return (
                    <motion.li key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                      <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-muted text-[10px] flex items-center justify-center text-ink-muted">
                        {p?.avatar_url ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" /> : (p?.display_name?.[0] || "?")}
                      </div>
                      <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-ink text-background" : "bg-muted text-ink"}`}>
                        {!mine && p && <div className="text-[10px] font-medium opacity-70 mb-0.5">{p.display_name || p.username}</div>}
                        <div className="whitespace-pre-wrap break-words">{m.body}</div>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </div>
        <form onSubmit={send} className="flex items-center gap-2 border-t border-border p-3">
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Say something in ${title}…`} maxLength={1000} />
          <Button type="submit" size="icon" className="rounded-full" disabled={!draft.trim() || sending}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>

      <div className="space-y-4">
        <MediaPanel
          m={media}
          channelTitle={title}
          meDisplay={meDisplay}
          meAvatar={meAvatar}
          profileLookup={profileLookup}
          others={others}
          onExit={handleExit}
        />
      </div>

      <AlertDialog open={warnOpen} onOpenChange={setWarnOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Still here?</AlertDialogTitle>
            <AlertDialogDescription>
              You've been muted with camera off for 2 minutes. Tap Stay or unmute — otherwise we'll drop you in 1 minute.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setWarnOpen(false)}>Stay</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </>
  );
}

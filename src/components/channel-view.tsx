import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MediaPanel, VideoStage } from "@/components/media-panel";
import { useMediaRoom } from "@/hooks/use-media-room";
import { toast } from "sonner";

type Message = { id: string; user_id: string; body: string; created_at: string };
type Presence = {
  user_id: string;
  last_seen_at: string;
  profile?: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
};

export function ChannelView({
  roomId,
  title,
  pinned,
}: {
  roomId: string;
  title: string;
  pinned?: React.ReactNode;
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Lift media room to ChannelView so VideoStage and MediaPanel share a single mesh.
  const media = useMediaRoom(roomId);

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

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-[1fr_260px]">
      <div className="flex flex-col rounded-3xl border border-border bg-surface shadow-soft overflow-hidden">
        {pinned && (
          <div className="border-b border-border bg-muted/40 px-4 py-3 md:px-6">
            {pinned}
          </div>
        )}
        <VideoStage m={media} meDisplay={meDisplay} profileLookup={profileLookup} />
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
        <MediaPanel m={media} channelTitle={title} meDisplay={meDisplay} meAvatar={meAvatar} profileLookup={profileLookup} />
        <aside className="rounded-3xl border border-border bg-surface p-4 shadow-soft">
          <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
            <Users className="h-3.5 w-3.5" /> Around · {presence.length}
          </h3>
          <ul className="mt-3 space-y-2">
            {presence.map((p) => (
              <li key={p.user_id} className="flex items-center gap-2">
                <div className="h-7 w-7 overflow-hidden rounded-full bg-muted text-[10px] flex items-center justify-center text-ink-muted">
                  {p.profile?.avatar_url ? <img src={p.profile.avatar_url} alt="" className="h-full w-full object-cover" /> : (p.profile?.display_name?.[0] || "?")}
                </div>
                {p.profile?.username ? (
                  <Link to="/u/$username" params={{ username: p.profile.username }} className="text-sm text-ink hover:underline truncate">
                    {p.profile?.display_name || p.profile.username}
                  </Link>
                ) : (
                  <span className="text-sm text-ink truncate">{p.profile?.display_name || "Anon"}</span>
                )}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

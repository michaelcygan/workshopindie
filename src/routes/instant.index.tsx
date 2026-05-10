import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Users, Radio, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { VoicePanel } from "@/components/voice-panel";

export const Route = createFileRoute("/instant/")({
  component: InstantChannels,
  head: () => ({
    meta: [
      { title: "Instant — Workshop" },
      { name: "description", content: "Drop into the Lounge or Tonight. See who's around and start something now." },
    ],
  }),
});

const CHANNELS = [
  { slug: "lounge", label: "The Lounge", blurb: "Always-on. Hang out, talk shop, find your people." },
  { slug: "tonight", label: "Tonight", blurb: "Anyone want to make something in the next few hours?" },
] as const;

type ChannelSlug = (typeof CHANNELS)[number]["slug"];

type Message = { id: string; user_id: string; body: string; created_at: string };
type Presence = {
  user_id: string;
  last_seen_at: string;
  profile?: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
};

function InstantChannels() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [active, setActive] = useState<ChannelSlug>("lounge");

  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/login" });
  }, [user, loading, router]);

  // Resolve channel rooms (the two seeded rows)
  const { data: rooms } = useQuery({
    queryKey: ["instant-channels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instant_rooms")
        .select("id,slug,title,description")
        .in("slug", ["lounge", "tonight"]);
      if (error) throw error;
      return data ?? [];
    },
  });

  const roomBySlug = useMemo(() => {
    const m: Record<string, { id: string; title: string; description: string | null }> = {};
    (rooms ?? []).forEach((r) => { if (r.slug) m[r.slug] = { id: r.id, title: r.title, description: r.description }; });
    return m;
  }, [rooms]);

  const room = roomBySlug[active];

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-ink md:text-5xl flex items-center gap-3">
            Instant
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
          </h1>
          <p className="mt-1 text-ink-muted">Two channels. Always live. Drop in.</p>
        </div>
      </motion.div>

      {/* Channel tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        {CHANNELS.map((c) => (
          <button
            key={c.slug}
            onClick={() => setActive(c.slug)}
            className={cn(
              "rounded-2xl border px-4 py-3 text-left transition flex-1 min-w-[220px]",
              active === c.slug
                ? "border-transparent bg-ink text-background shadow-lift"
                : "border-border bg-surface text-ink hover:bg-muted",
            )}
          >
            <div className="flex items-center gap-2 font-display text-lg">
              {c.slug === "tonight" ? <Calendar className="h-4 w-4" /> : <Radio className="h-4 w-4" />}
              {c.label}
              {active === c.slug && <PresencePill roomId={room?.id} />}
            </div>
            <div className={cn("mt-1 text-xs", active === c.slug ? "text-background/70" : "text-ink-muted")}>{c.blurb}</div>
          </button>
        ))}
      </div>

      {/* Live channel */}
      {room ? (
        <ChannelView key={room.id} roomId={room.id} title={room.title} />
      ) : (
        <div className="mt-6 h-[60vh] animate-pulse rounded-3xl bg-surface-2" />
      )}
    </main>
  );
}

function PresencePill({ roomId }: { roomId: string | undefined }) {
  const { data } = useQuery({
    queryKey: ["instant-presence-count", roomId],
    queryFn: async () => {
      if (!roomId) return 0;
      const { count } = await supabase.from("instant_presence").select("user_id", { count: "exact", head: true }).eq("room_id", roomId);
      return count ?? 0;
    },
    enabled: !!roomId,
    refetchInterval: 15_000,
  });
  if (!data) return null;
  return (
    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-background/15 px-2 py-0.5 text-xs">
      <Users className="h-3 w-3" /> {data}
    </span>
  );
}

function ChannelView({ roomId, title }: { roomId: string; title: string }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Join + subscribe
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

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-[1fr_240px]">
      <div className="flex flex-col rounded-3xl border border-border bg-surface shadow-soft overflow-hidden">
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
        <div className="mt-4 rounded-xl bg-muted p-3 text-xs text-ink-muted">
          Voice rooms are coming. For now, chat here, then spin up a Workshop to actually make something.
        </div>
      </aside>
    </div>
  );
}

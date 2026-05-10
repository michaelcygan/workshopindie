import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, LogOut, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryChip } from "@/components/category-chip";
import type { Category } from "@/lib/categories";
import { toast } from "sonner";

export const Route = createFileRoute("/instant/$id")({ component: InstantRoom });

type Message = { id: string; user_id: string; body: string; created_at: string };
type Presence = { user_id: string; last_seen_at: string; profile?: { display_name: string | null; username: string | null; avatar_url: string | null } | null };

function InstantRoom() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/login" });
  }, [user, loading, router]);

  const { data: room, isLoading: roomLoading } = useQuery({
    queryKey: ["instant-room", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instant_rooms")
        .select("id,title,category,status,city:cities!instant_rooms_city_id_fkey(name)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Join: upsert own presence + subscribe to channels
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function join() {
      // Upsert presence
      await supabase.from("instant_presence").upsert({
        room_id: id, user_id: user!.id, status: "active", last_seen_at: new Date().toISOString(),
      });

      // Initial loads
      const [msgs, pres] = await Promise.all([
        supabase.from("instant_messages").select("id,user_id,body,created_at").eq("room_id", id).order("created_at", { ascending: true }).limit(200),
        supabase.from("instant_presence").select("user_id,last_seen_at,profile:profiles!instant_presence_user_id_fkey(display_name,username,avatar_url)").eq("room_id", id),
      ]);
      if (cancelled) return;
      setMessages((msgs.data ?? []) as Message[]);
      setPresence((pres.data ?? []) as unknown as Presence[]);
    }
    join();

    // Realtime
    const channel = supabase
      .channel(`instant:${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "instant_messages", filter: `room_id=eq.${id}` },
        (p) => setMessages((prev) => [...prev, p.new as Message]))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "instant_presence", filter: `room_id=eq.${id}` },
        async (p) => {
          const newRow = p.new as Presence;
          const { data } = await supabase.from("profiles").select("display_name,username,avatar_url").eq("id", newRow.user_id).maybeSingle();
          setPresence((prev) => prev.find((x) => x.user_id === newRow.user_id) ? prev : [...prev, { ...newRow, profile: data }]);
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "instant_presence", filter: `room_id=eq.${id}` },
        (p) => setPresence((prev) => prev.filter((x) => x.user_id !== (p.old as Presence).user_id)))
      .subscribe();

    // Heartbeat
    const heartbeat = setInterval(() => {
      supabase.from("instant_presence").update({ last_seen_at: new Date().toISOString() })
        .eq("room_id", id).eq("user_id", user.id);
    }, 30_000);

    // Leave on unmount / unload
    function leave() {
      supabase.from("instant_presence").delete().eq("room_id", id).eq("user_id", user!.id);
    }
    window.addEventListener("beforeunload", leave);

    return () => {
      cancelled = true;
      clearInterval(heartbeat);
      supabase.removeChannel(channel);
      window.removeEventListener("beforeunload", leave);
      leave();
    };
  }, [id, user]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !draft.trim()) return;
    setSending(true);
    const body = draft.trim().slice(0, 1000);
    setDraft("");
    const { error } = await supabase.from("instant_messages").insert({ room_id: id, user_id: user.id, body });
    setSending(false);
    if (error) toast.error(error.message);
  }

  async function leaveRoom() {
    if (!user) return;
    await supabase.from("instant_presence").delete().eq("room_id", id).eq("user_id", user.id);
    router.navigate({ to: "/instant" });
  }

  if (roomLoading) return <main className="mx-auto max-w-4xl p-10"><div className="h-96 animate-pulse rounded-3xl bg-surface-2" /></main>;
  if (!room) return <main className="mx-auto max-w-4xl p-10 text-center text-ink-muted">Room not found.</main>;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-10">
      <div className="flex items-center gap-3">
        <Link to="/instant" className="rounded-full p-2 hover:bg-muted text-ink-soft"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="flex flex-1 items-center gap-2">
          {room.category && <CategoryChip category={room.category as Category} />}
          <h1 className="font-display text-2xl text-ink line-clamp-1">{room.title}</h1>
          {(room.city as any)?.name && <span className="text-xs text-ink-muted">· {(room.city as any).name}</span>}
        </div>
        <Button variant="ghost" size="sm" className="rounded-full gap-1 text-ink-muted" onClick={leaveRoom}>
          <LogOut className="h-3.5 w-3.5" /> Leave
        </Button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_240px]">
        <div className="flex flex-col rounded-3xl border border-border bg-surface shadow-soft overflow-hidden">
          <div ref={scrollRef} className="h-[60vh] overflow-y-auto px-4 py-4 md:px-6">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center">
                <div>
                  <p className="font-display text-xl text-ink">Quiet in here.</p>
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
                        <div className={`h-7 w-7 shrink-0 overflow-hidden rounded-full bg-muted text-[10px] flex items-center justify-center text-ink-muted`}>
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
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Say something…" maxLength={1000} />
            <Button type="submit" size="icon" className="rounded-full" disabled={!draft.trim() || sending}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>

        <aside className="rounded-3xl border border-border bg-surface p-4 shadow-soft">
          <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
            <Users className="h-3.5 w-3.5" /> In the room · {presence.length}
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
    </main>
  );
}

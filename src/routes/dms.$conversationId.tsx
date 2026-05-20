import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Send } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { sendMessage, markConversationRead } from "@/lib/dms.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

type ProfileLite = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export const Route = createFileRoute("/dms/$conversationId")({
  component: DmsThread,
  head: () => ({ meta: [{ title: "Conversation — Workshop" }] }),
});

function DmsThread() {
  const { user, loading } = useAuth();
  const { conversationId } = Route.useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [other, setOther] = useState<ProfileLite | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const send = useServerFn(sendMessage);
  const markRead = useServerFn(markConversationRead);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: conv } = await supabase
        .from("conversations")
        .select("id, user_a, user_b")
        .eq("id", conversationId)
        .maybeSingle();
      if (!conv) {
        navigate({ to: "/dms" });
        return;
      }
      const otherId = conv.user_a === user.id ? conv.user_b : conv.user_a;
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .eq("id", otherId)
        .maybeSingle();
      if (cancelled) return;
      setOther(prof as ProfileLite | null);

      const { data: msgs } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, body, created_at, read_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (cancelled) return;
      setMessages((msgs ?? []) as Message[]);
      try { await markRead({ data: { conversationId } }); } catch { /* ignore */ }
    })();

    const channel = supabase
      .channel(`dm:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) => {
            const m = payload.new as Message;
            if (prev.some((x) => x.id === m.id)) return prev;
            return [...prev, m];
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user?.id, conversationId, navigate, markRead]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (loading) return null;
  if (!user) throw redirect({ to: "/login", search: { redirect: `/dms/${conversationId}` } as any });

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await send({ data: { conversationId, body: trimmed } });
      setBody("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto flex h-[calc(100dvh-4rem)] max-w-2xl flex-col px-4 py-4">
      <header className="flex items-center gap-3 border-b border-border pb-3">
        <Link to="/dms" className="rounded-full p-1.5 text-ink-muted hover:bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="h-9 w-9 overflow-hidden rounded-full bg-muted">
          {other?.avatar_url ? <img src={other.avatar_url} alt="" className="h-full w-full object-cover" /> : null}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{other?.display_name ?? other?.username ?? "Conversation"}</p>
          {other?.username && <p className="truncate text-xs text-ink-muted">@{other.username}</p>}
        </div>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto py-4">
        {messages.length === 0 ? (
          <p className="mt-12 text-center text-sm text-ink-muted">Say hi.</p>
        ) : messages.map((m) => {
          const mine = m.sender_id === user.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted text-ink"}`}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form onSubmit={onSend} className="flex items-center gap-2 border-t border-border pt-3">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message…"
          maxLength={2000}
          autoFocus
          className="rounded-full"
        />
        <Button type="submit" disabled={sending || !body.trim()} size="icon" className="shrink-0 rounded-full">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </main>
  );
}

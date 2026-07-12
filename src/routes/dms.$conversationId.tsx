import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RequireAuth } from "@/components/require-auth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Send, MoreHorizontal, Flag, UserX, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { sendMessage, markConversationRead } from "@/lib/dms.functions";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { MessageBody, type MentionCandidate } from "@/components/chat-mention-input";
import { MentionPopover } from "@/components/mention-popover";
import { UsernameMention } from "@/components/username-mention";
import type { MentionSuggestion } from "@/lib/mention-suggestions";

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
  // client-only fields for optimistic state
  _optimistic?: boolean;
  _failed?: boolean;
};

type ProfileLite = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

const PAGE_SIZE = 80;

export const Route = createFileRoute("/dms/$conversationId")({
  component: () => <RequireAuth><DmsThread /></RequireAuth>,
  head: () => ({
    meta: [
      { title: "Conversation — Workshop" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function DmsThread() {
  const { user, loading } = useAuth();
  const { conversationId } = Route.useParams();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<Message[]>([]);
  const [other, setOther] = useState<ProfileLite | null>(null);
  const [collab, setCollab] = useState<{ title: string; slug: string } | null>(null);
  const [workshop, setWorkshop] = useState<{ title: string | null; slug: string } | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [oldestCursor, setOldestCursor] = useState<string | null>(null);
  // (the unread divider is computed from each message's read_at inside groupMessages)
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);

  const send = useServerFn(sendMessage);
  const markRead = useServerFn(markConversationRead);
  const markReadRef = useRef(markRead);
  markReadRef.current = markRead;

  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const bufferedRef = useRef<Message[]>([]);
  const readyRef = useRef(false);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSentRef = useRef(0);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  // Auto-grow textarea
  useEffect(() => {
    const ta = composerRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [body]);

  // Initial load + realtime subscribe-first
  useEffect(() => {
    if (!user) return;
    const uid = user.id;
    let cancelled = false;
    readyRef.current = false;
    bufferedRef.current = [];

    // Subscribe first so events that land during the initial fetch are buffered.
    const channel = supabase
      .channel(`dm:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as Message;
          if (!readyRef.current) {
            bufferedRef.current.push(m);
            return;
          }
          setMessages((prev) => mergeMessage(prev, m));
          if (m.sender_id !== uid && document.visibilityState === "visible") {
            // Mark inbound as read live
            markReadRef.current({ data: { conversationId } }).catch(() => {});
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, read_at: m.read_at } : x)));
        },
      )
      .subscribe();

    (async () => {
      const { data: conv } = await supabase
        .from("conversations")
        .select("id, user_a, user_b, context_collab_post_id, context_workshop_id")
        .eq("id", conversationId)
        .maybeSingle();
      if (cancelled) return;
      if (!conv) {
        navigate({ to: "/dms" });
        return;
      }
      const otherId = conv.user_a === uid ? conv.user_b : conv.user_a;
      const [{ data: prof }, { data: post }, { data: ws }] = await Promise.all([
        supabase.from("profiles").select("id, username, display_name, avatar_url").eq("id", otherId).maybeSingle(),
        conv.context_collab_post_id
          ? supabase.from("collab_posts").select("title, slug").eq("id", conv.context_collab_post_id).maybeSingle()
          : Promise.resolve({ data: null }),
        conv.context_workshop_id
          ? supabase.from("workshops").select("title, slug").eq("id", conv.context_workshop_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (cancelled) return;
      setOther(prof as ProfileLite | null);
      setCollab(post ? { title: post.title, slug: post.slug } : null);
      setWorkshop(ws ? { title: ws.title ?? null, slug: ws.slug } : null);

      const { data: msgs } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, body, created_at, read_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE + 1);
      if (cancelled) return;

      const list = ((msgs ?? []) as Message[]).reverse();
      const hasMore = list.length > PAGE_SIZE;
      const sliced = hasMore ? list.slice(1) : list;

      // (unread divider is computed per-message from read_at inside groupMessages)


      // Merge any messages that arrived while we were fetching.
      let merged = sliced;
      for (const m of bufferedRef.current) {
        merged = mergeMessage(merged, m);
      }
      bufferedRef.current = [];
      readyRef.current = true;

      setMessages(merged);
      setHasMoreOlder(hasMore);
      setOldestCursor(sliced.length ? sliced[0].created_at : null);

      try { await markReadRef.current({ data: { conversationId } }); } catch { /* ignore */ }

      // Initial scroll to bottom (no animation).
      requestAnimationFrame(() => {
        endRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
      });
    })();

    function onVisibility() {
      if (document.visibilityState === "visible") {
        markReadRef.current({ data: { conversationId } }).catch(() => {});
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user?.id, conversationId, navigate]);

  // Presence + typing broadcast — scoped to this conversation
  useEffect(() => {
    if (!user) return;
    const uid = user.id;
    const ch = supabase.channel(`dm-presence:${conversationId}`, {
      config: { presence: { key: uid } },
    });
    presenceChannelRef.current = ch;

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<string, unknown[]>;
      const otherKeys = Object.keys(state).filter((k) => k !== uid);
      setOtherOnline(otherKeys.length > 0);
    })
      .on("broadcast", { event: "typing" }, (payload) => {
        const from = (payload.payload as { from?: string } | undefined)?.from;
        if (!from || from === uid) return;
        setOtherTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setOtherTyping(false), 3500);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await ch.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      supabase.removeChannel(ch);
      presenceChannelRef.current = null;
    };
  }, [user?.id, conversationId]);

  function emitTyping() {
    const ch = presenceChannelRef.current;
    if (!ch || !user) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = now;
    ch.send({ type: "broadcast", event: "typing", payload: { from: user.id } }).catch(() => {});
  }


  // Smooth scroll on new messages, but only if user is near bottom
  const lastCount = useRef(0);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) { lastCount.current = messages.length; return; }
    const grew = messages.length > lastCount.current;
    lastCount.current = messages.length;
    if (!grew) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distance < 200) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages.length]);

  const loadOlder = useCallback(async () => {
    if (!oldestCursor || loadingOlder) return;
    setLoadingOlder(true);
    const el = scrollerRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const { data: older } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, body, created_at, read_at")
      .eq("conversation_id", conversationId)
      .lt("created_at", oldestCursor)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE + 1);
    const list = ((older ?? []) as Message[]).reverse();
    const hasMore = list.length > PAGE_SIZE;
    const sliced = hasMore ? list.slice(1) : list;
    if (sliced.length) {
      setMessages((prev) => [...sliced, ...prev]);
      setOldestCursor(sliced[0].created_at);
    }
    setHasMoreOlder(hasMore);
    setLoadingOlder(false);
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevHeight;
    });
  }, [conversationId, oldestCursor, loadingOlder]);

  async function onSend(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || sending || !user) return;
    setSending(true);
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: Message = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: user.id,
      body: trimmed,
      created_at: new Date().toISOString(),
      read_at: null,
      _optimistic: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setBody("");
    composerRef.current?.focus();

    try {
      const r = await send({ data: { conversationId, body: trimmed } });
      // Replace the optimistic bubble with the real id (the realtime INSERT
      // may also arrive — mergeMessage dedupes by id).
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? { ...m, id: r.id, created_at: r.createdAt, _optimistic: false }
            : m,
        ),
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, _failed: true, _optimistic: false } : m)),
      );
      toast.error(err instanceof Error ? err.message : "Couldn't send");
    } finally {
      setSending(false);
    }
  }

  function onComposerKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  async function blockOther() {
    if (!user || !other) return;
    const { error } = await supabase
      .from("user_blocks")
      .insert({ blocker_user_id: user.id, blocked_user_id: other.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Blocked. You won't see each other.");
    navigate({ to: "/dms" });
  }

  async function reportConversation(reason: string) {
    if (!user || !other) return;
    const { error } = await supabase.from("reports").insert({
      reporter_user_id: user.id,
      entity_type: "dm_conversation",
      entity_id: conversationId,
      reason,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Reported. Our team will review.");
    setReportOpen(false);
  }

  const grouped = useMemo(() => groupMessages(messages, user?.id ?? null), [messages, user?.id]);

  if (loading || !user) return null;

  const charsLeft = 2000 - body.length;
  const showCounter = body.length > 1800;

  return (
    <main className="mx-auto flex h-[100dvh] max-w-3xl flex-col px-0 sm:px-4">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur sm:rounded-b-2xl">
        <Link
          to="/dms"
          aria-label="Back to inbox"
          className="rounded-full p-1.5 text-ink-muted hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="relative">
          <Avatar className="h-10 w-10 ring-1 ring-border">
            {other?.avatar_url ? <AvatarImage src={other.avatar_url} alt="" /> : null}
            <AvatarFallback className="bg-gradient-to-br from-primary/15 to-coral/15 font-display text-sm text-ink">
              {initials(other)}
            </AvatarFallback>
          </Avatar>
          {otherOnline && (
            <span
              aria-label="Online"
              className="absolute bottom-0 right-0 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">
            {other?.display_name ?? other?.username ?? "Conversation"}
          </p>
          {otherTyping ? (
            <p className="truncate text-xs text-primary">typing…</p>
          ) : other?.username ? (
            <p className="truncate text-xs text-ink-muted">@{other.username}</p>
          ) : null}

          {(collab || workshop) && (
            <div className="mt-1">
              {collab ? (
                <Link
                  to="/collab/$slug"
                  params={{ slug: collab.slug }}
                  className="inline-flex max-w-full items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary hover:bg-primary/15"
                  title={`Re: ${collab.title}`}
                >
                  <span className="truncate">Re: {collab.title}</span>
                </Link>
              ) : workshop ? (
                <Link
                  to="/workshops/$slug"
                  params={{ slug: workshop.slug }}
                  className="inline-flex max-w-full items-center rounded-full bg-violet/10 px-2 py-0.5 text-[11px] text-violet hover:bg-violet/15"
                  title={`Re: ${workshop.title ?? "Lounge"}`}
                >
                  <span className="truncate">Re: {workshop.title ?? "Workshop"}</span>
                </Link>
              ) : null}
            </div>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Conversation options" className="rounded-full">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => setReportOpen(true)}>
              <Flag className="mr-2 h-4 w-4" /> Report
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setBlockOpen(true)}
              className="text-coral focus:text-coral"
            >
              <UserX className="mr-2 h-4 w-4" /> Block
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Messages */}
      <div
        ref={scrollerRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        className="flex-1 space-y-1 overflow-y-auto px-4 py-4"
      >
        {hasMoreOlder && (
          <div className="mb-2 flex justify-center">
            <button
              type="button"
              onClick={loadOlder}
              disabled={loadingOlder}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs text-ink-soft hover:bg-muted disabled:opacity-60"
            >
              {loadingOlder ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Load older messages
            </button>
          </div>
        )}

        {messages.length === 0 ? (
          <EmptyThread
            otherName={other?.display_name ?? other?.username ?? null}
            onPick={(text) => {
              setBody(text);
              setTimeout(() => composerRef.current?.focus(), 0);
            }}
          />
        ) : (
          grouped.map((g) => {
            if (g.kind === "day") {
              return (
                <div key={g.id} className="my-3 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                    {g.label}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              );
            }
            if (g.kind === "unread-divider") {
              return (
                <div key={g.id} className="my-3 flex items-center gap-3">
                  <div className="h-px flex-1 bg-coral/40" />
                  <span className="rounded-full bg-coral/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-coral">
                    New
                  </span>
                  <div className="h-px flex-1 bg-coral/40" />
                </div>
              );
            }
            const isLast = g.id === grouped[grouped.length - 1]?.id;
            return (
              <MessageCluster
                key={g.id}
                cluster={g}
                isLastCluster={isLast}
                onRetry={async (m) => {
                  // Re-send a failed message
                  setMessages((prev) => prev.filter((x) => x.id !== m.id));
                  setBody(m.body);
                  setTimeout(() => onSend(), 0);
                }}
              />
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={onSend}
        className="border-t border-border bg-background/85 px-4 py-3 backdrop-blur"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <label htmlFor="dm-composer" className="sr-only">Message</label>
        <div className="relative flex items-end gap-2 rounded-3xl border border-border bg-surface px-2 py-1.5 focus-within:border-primary">
          <textarea
            id="dm-composer"
            ref={composerRef}
            value={body}
            onChange={(e) => { setBody(e.target.value); emitTyping(); }}
            onKeyDown={onComposerKey}
            placeholder="Message…"
            rows={1}
            maxLength={2000}
            autoFocus
            className="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none"
          />
          <div className="flex shrink-0 items-center gap-1.5 pb-1 pr-1">
            {showCounter && (
              <span className={`text-[11px] ${charsLeft < 0 ? "text-coral" : "text-ink-muted"}`}>
                {charsLeft}
              </span>
            )}
            <Button
              type="submit"
              size="icon"
              disabled={sending || !body.trim() || charsLeft < 0}
              className="h-9 w-9 shrink-0 rounded-full"
              aria-label="Send message"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <p className="mt-1.5 px-2 text-[10px] text-ink-muted">
          Enter to send · Shift + Enter for a new line
        </p>
      </form>

      {/* Report dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Report conversation</DialogTitle>
            <DialogDescription>
              Tell us what's wrong. Our team reviews every report.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {[
              { id: "spam", label: "Spam or scam" },
              { id: "harassment", label: "Harassment or bullying" },
              { id: "hate", label: "Hate or violence" },
              { id: "csam_or_minor", label: "Minor safety / illegal" },
              { id: "other", label: "Something else" },
            ].map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => reportConversation(r.id)}
                className="rounded-2xl border border-border bg-surface px-3 py-2 text-left text-sm text-ink hover:bg-muted/60"
              >
                {r.label}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Block confirm */}
      <AlertDialog open={blockOpen} onOpenChange={setBlockOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block {other?.display_name ?? other?.username ?? "this person"}?</AlertDialogTitle>
            <AlertDialogDescription>
              You won't see each other's posts or messages, and any follow between you is removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={blockOther} className="bg-coral text-background hover:bg-coral/90">
              Block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

/* -------------------- grouping + rendering helpers -------------------- */

type Cluster = {
  kind: "cluster";
  id: string;
  mine: boolean;
  messages: Message[];
};
type DaySep = { kind: "day"; id: string; label: string };
type UnreadSep = { kind: "unread-divider"; id: string };
type GroupItem = Cluster | DaySep | UnreadSep;

function groupMessages(messages: Message[], uid: string | null): GroupItem[] {
  const out: GroupItem[] = [];
  let lastDayKey = "";
  let lastSender = "";
  let lastTime = 0;
  let unreadInserted = false;
  let currentCluster: Cluster | null = null;
  // Detect divider before first inbound unread, only if it's not the very first message.
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const t = new Date(m.created_at).getTime();
    const dayKey = dayBucket(m.created_at);

    if (dayKey !== lastDayKey) {
      out.push({ kind: "day", id: `day-${dayKey}-${i}`, label: dayLabel(m.created_at) });
      lastDayKey = dayKey;
      currentCluster = null;
      lastSender = "";
    }

    if (!unreadInserted && uid && m.sender_id !== uid && !m.read_at && i > 0) {
      out.push({ kind: "unread-divider", id: `unread-${m.id}` });
      unreadInserted = true;
      currentCluster = null;
      lastSender = "";
    }

    const sameCluster =
      currentCluster &&
      m.sender_id === lastSender &&
      t - lastTime < 2 * 60 * 1000;

    if (sameCluster && currentCluster) {
      currentCluster.messages.push(m);
    } else {
      currentCluster = {
        kind: "cluster",
        id: `c-${m.id}`,
        mine: uid !== null && m.sender_id === uid,
        messages: [m],
      };
      out.push(currentCluster);
    }
    lastSender = m.sender_id;
    lastTime = t;
  }
  return out;
}

function dayBucket(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, today)) return "Today";
  if (same(d, yest)) return "Yesterday";
  if (d.getFullYear() === today.getFullYear()) {
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function MessageCluster({
  cluster,
  isLastCluster,
  onRetry,
}: {
  cluster: Cluster;
  isLastCluster: boolean;
  onRetry: (m: Message) => void;
}) {
  const { mine, messages } = cluster;
  const last = messages[messages.length - 1];
  const showSeen = mine && isLastCluster && last.read_at && !last._optimistic && !last._failed;
  const showDelivered = mine && isLastCluster && !last.read_at && !last._optimistic && !last._failed;

  return (
    <div className={`flex flex-col gap-0.5 ${mine ? "items-end" : "items-start"}`}>
      {messages.map((m, idx) => {
        const first = idx === 0;
        const lastInCluster = idx === messages.length - 1;
        const radius = mine
          ? `rounded-2xl ${first ? "" : "rounded-tr-md"} ${lastInCluster ? "" : "rounded-br-md"}`
          : `rounded-2xl ${first ? "" : "rounded-tl-md"} ${lastInCluster ? "" : "rounded-bl-md"}`;
        return (
          <div
            key={m.id}
            className={`group relative max-w-[80%] ${mine ? "self-end" : "self-start"}`}
          >
            <div
              className={`${radius} px-3.5 py-2 text-sm ${
                mine
                  ? m._failed
                    ? "bg-coral/15 text-coral border border-coral/40"
                    : `bg-ink text-background ${m._optimistic ? "opacity-70" : ""}`
                  : "bg-surface-2 text-ink border border-border"
              } transition`}
              title={new Date(m.created_at).toLocaleString()}
            >
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
            </div>
            {m._failed && (
              <button
                type="button"
                onClick={() => onRetry(m)}
                className="mt-0.5 mr-1 text-[10px] text-coral underline-offset-2 hover:underline"
              >
                Failed — tap to retry
              </button>
            )}
          </div>
        );
      })}
      {showSeen && (
        <span className="mr-1 mt-0.5 text-[10px] text-ink-muted">
          Seen {timeOnly(last.read_at!)}
        </span>
      )}
      {showDelivered && (
        <span className="mr-1 mt-0.5 text-[10px] text-ink-muted">Delivered</span>
      )}
    </div>
  );
}

function EmptyThread({
  otherName,
  onPick,
}: {
  otherName: string | null;
  onPick: (text: string) => void;
}) {
  const first = otherName?.split(/\s+/)[0] ?? "them";
  const breakers = [
    `Hey ${first} — loved your last post.`,
    `Want to collab on something?`,
    `Free this week to jam?`,
  ];
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="font-display text-lg text-ink">Say hi to {first}.</p>
      <p className="mt-1 text-xs text-ink-muted">Or pick a starter:</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {breakers.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => onPick(b)}
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-ink hover:bg-muted/60"
          >
            {b}
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------- pure helpers -------------------- */

function mergeMessage(prev: Message[], m: Message): Message[] {
  // If we already have it by id, leave alone.
  if (prev.some((x) => x.id === m.id)) return prev;
  // If a matching optimistic bubble exists from the same sender with the same
  // body within ~10s, replace it instead of duplicating.
  const idx = prev.findIndex(
    (x) =>
      x._optimistic &&
      x.sender_id === m.sender_id &&
      x.body === m.body &&
      Math.abs(new Date(x.created_at).getTime() - new Date(m.created_at).getTime()) < 10_000,
  );
  if (idx >= 0) {
    const next = prev.slice();
    next[idx] = { ...m };
    return next;
  }
  return [...prev, m];
}

function initials(p: ProfileLite | null): string {
  if (!p) return "?";
  const src = (p.display_name ?? p.username ?? "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function timeOnly(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

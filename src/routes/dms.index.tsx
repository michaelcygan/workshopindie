import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus, Sparkles, ArrowLeft, Pencil } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/require-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { NewMessageDialog } from "@/components/new-message-dialog";

type ConversationRow = {
  id: string;
  user_a: string;
  user_b: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  context_collab_post_id: string | null;
  context_workshop_id: string | null;
};

type CollabLite = { id: string; title: string; slug: string };
type WorkshopLite = { id: string; title: string | null; slug: string };

type ProfileLite = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type Row = {
  conv: ConversationRow;
  other: ProfileLite | null;
  unread: number;
  collab: CollabLite | null;
  workshop: WorkshopLite | null;
  lastFromMe: boolean;
};

type Tab = "all" | "unread" | "collabs" | "workshops";

const MAX_CONVERSATIONS = 500;

export const Route = createFileRoute("/dms/")({
  component: () => <RequireAuth><DmsIndex /></RequireAuth>,
  head: () => ({
    meta: [
      { title: "Messages — Workshop" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function DmsIndex() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load(uid: string) {
    const { data: convs } = await supabase
      .from("conversations")
      .select("id, user_a, user_b, last_message_at, last_message_preview, context_collab_post_id, context_workshop_id")
      .or(`user_a.eq.${uid},user_b.eq.${uid}`)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(MAX_CONVERSATIONS);
    const list = (convs ?? []) as ConversationRow[];
    const otherIds = list.map((c) => (c.user_a === uid ? c.user_b : c.user_a));
    const collabIds = Array.from(new Set(list.map((c) => c.context_collab_post_id).filter(Boolean) as string[]));
    const workshopIds = Array.from(new Set(list.map((c) => c.context_workshop_id).filter(Boolean) as string[]));

    const [{ data: profs }, { data: collabs }, { data: workshops }, { data: unreadMsgs }, { data: lastFrom }] = await Promise.all([
      otherIds.length
        ? supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", otherIds)
        : Promise.resolve({ data: [] as ProfileLite[] }),
      collabIds.length
        ? supabase.from("collab_posts").select("id, title, slug").in("id", collabIds)
        : Promise.resolve({ data: [] as CollabLite[] }),
      workshopIds.length
        ? supabase.from("workshops").select("id, title, slug").in("id", workshopIds)
        : Promise.resolve({ data: [] as WorkshopLite[] }),
      list.length
        ? supabase
            .from("messages")
            .select("conversation_id")
            .in("conversation_id", list.map((c) => c.id))
            .neq("sender_id", uid)
            .is("read_at", null)
        : Promise.resolve({ data: [] as { conversation_id: string }[] }),
      list.length
        ? supabase
            .from("messages")
            .select("conversation_id, sender_id, created_at")
            .in("conversation_id", list.map((c) => c.id))
            .order("created_at", { ascending: false })
            .limit(list.length * 2)
        : Promise.resolve({ data: [] as { conversation_id: string; sender_id: string; created_at: string }[] }),
    ]);

    const byId = new Map((profs ?? []).map((p) => [p.id, p as ProfileLite]));
    const collabById = new Map((collabs ?? []).map((c) => [c.id, c as CollabLite]));
    const workshopById = new Map((workshops ?? []).map((w) => [w.id, w as WorkshopLite]));

    const unreadCounts = new Map<string, number>();
    for (const m of unreadMsgs ?? []) {
      unreadCounts.set(m.conversation_id, (unreadCounts.get(m.conversation_id) ?? 0) + 1);
    }

    // last-from-me lookup (first row per conversation in desc order)
    const lastBy = new Map<string, string>();
    for (const m of lastFrom ?? []) {
      if (!lastBy.has(m.conversation_id)) lastBy.set(m.conversation_id, m.sender_id);
    }

    return list.map((c) => ({
      conv: c,
      other: byId.get(c.user_a === uid ? c.user_b : c.user_a) ?? null,
      unread: unreadCounts.get(c.id) ?? 0,
      collab: c.context_collab_post_id ? collabById.get(c.context_collab_post_id) ?? null : null,
      workshop: c.context_workshop_id ? workshopById.get(c.context_workshop_id) ?? null : null,
      lastFromMe: lastBy.get(c.id) === uid,
    }));
  }

  useEffect(() => {
    if (!user) return;
    const uid = user.id;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    function scheduleReload() {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = setTimeout(() => {
        load(uid).then((r) => { if (!cancelled) setRows(r); }).catch(() => {});
      }, 250);
    }


    (async () => {
      setBusy(true);
      try {
        const r = await load(uid);
        if (!cancelled) {
          setRows(r);
          setBusy(false);
        }
      } catch {
        if (!cancelled) setBusy(false);
      }

      // Realtime: refresh row order / unread counts on inbound activity.
      channel = supabase
        .channel(`dms-index:${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "messages" },
          () => scheduleReload(),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "conversations", filter: `user_a=eq.${uid}` },
          () => scheduleReload(),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "conversations", filter: `user_b=eq.${uid}` },
          () => scheduleReload(),
        )
        .subscribe();
    })();


    function onFocus() { scheduleReload(); }
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      if (channel) supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [user?.id]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab === "unread" && r.unread === 0) return false;
      if (tab === "collabs" && !r.collab) return false;
      if (tab === "workshops" && !r.workshop) return false;
      if (!query) return true;
      const hay = [
        r.other?.display_name ?? "",
        r.other?.username ?? "",
        r.conv.last_message_preview ?? "",
        r.collab?.title ?? "",
        r.workshop?.title ?? "",
      ].join(" ").toLowerCase();
      return hay.includes(query);
    });
  }, [rows, tab, q]);

  const counts = useMemo(() => ({
    all: rows.length,
    unread: rows.filter((r) => r.unread > 0).length,
    collabs: rows.filter((r) => r.collab).length,
    workshops: rows.filter((r) => r.workshop).length,
  }), [rows]);

  if (loading || !user) return null;

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "all", label: "All", count: counts.all },
    { id: "unread", label: "Unread", count: counts.unread },
    { id: "collabs", label: "Collabs", count: counts.collabs },
    { id: "workshops", label: "Lounges", count: counts.workshops },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      {/* Hero header — matches /groups, /gallery tone */}
      <header className="flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2 md:hidden">
            <Link
              to="/"
              aria-label="Home"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-muted/60"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
          <h1 className="font-display text-3xl text-ink md:text-4xl">Messages</h1>
          <p className="mt-1 text-sm text-ink-muted">
            <span className={`mr-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              counts.unread > 0
                ? "bg-coral/15 text-coral"
                : "bg-primary/10 text-primary"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${counts.unread > 0 ? "bg-coral" : "bg-primary"} ${counts.unread > 0 ? "animate-pulse" : ""}`} />
              Inbox
            </span>
            {counts.all > 0
              ? `${counts.all} thread${counts.all === 1 ? "" : "s"}${counts.unread > 0 ? ` · ${counts.unread} unread` : ""}`
              : "DM mutuals — or anyone connected to your collabs and Lounges."}
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setComposeOpen(true)}
          className="shrink-0 rounded-full gap-1.5"
        >
          <Pencil className="h-4 w-4" />
          <span className="hidden sm:inline">New message</span>
          <span className="sm:hidden">New</span>
        </Button>
      </header>

      {!busy && rows.length > 0 && (
        <div className="sticky top-16 z-10 -mx-4 mt-5 border-y border-border/60 bg-background/85 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex rounded-full bg-muted p-0.5">
              {tabs.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    aria-pressed={active}
                    className={`relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      active ? "bg-ink text-background shadow-soft" : "text-ink-soft hover:text-ink"
                    }`}
                  >
                    {t.label}
                    {t.count > 0 && (
                      <span className={`rounded-full px-1.5 text-[10px] ${
                        active ? "bg-background/20 text-background" : "bg-background/60 text-ink-muted"
                      }`}>
                        {t.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="relative ml-auto flex-1 min-w-[180px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name or message…"
                className="w-full rounded-full border border-border bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {busy ? (
        <div className="mt-6 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[68px] animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyInbox onNew={() => setComposeOpen(true)} />
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-ink-muted">
          No conversations match.
        </div>
      ) : (
        <ul className="mt-4 space-y-1.5">
          {filtered.map(({ conv, other, unread, collab, workshop, lastFromMe }) => (
            <li key={conv.id}>
              <button
                type="button"
                onClick={() =>
                  navigate({ to: "/dms/$conversationId", params: { conversationId: conv.id } })
                }
                aria-label={`${other?.display_name ?? other?.username ?? "Conversation"}${
                  unread > 0 ? ` — ${unread} unread` : ""
                }${conv.last_message_preview ? ` — last message: ${conv.last_message_preview}` : ""}`}
                className={`group flex w-full items-center gap-3 rounded-2xl border bg-surface px-3.5 py-3 text-left transition hover:bg-muted/40 hover:shadow-soft ${
                  unread > 0 ? "border-coral/40" : "border-border"
                }`}
              >
                <Avatar className="h-12 w-12 shrink-0 ring-1 ring-border">
                  {other?.avatar_url ? <AvatarImage src={other.avatar_url} alt="" /> : null}
                  <AvatarFallback className="bg-gradient-to-br from-primary/15 to-coral/15 font-display text-sm text-ink">
                    {avatarInitials(other)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`truncate text-sm ${unread > 0 ? "font-semibold text-ink" : "font-medium text-ink"}`}>
                      {other?.display_name ?? other?.username ?? "Someone"}
                    </span>
                    {conv.last_message_at && (
                      <span className="shrink-0 text-[11px] text-ink-muted">
                        {relativeTime(conv.last_message_at)}
                      </span>
                    )}
                  </div>
                  {(collab || workshop) && (
                    <span className={`mt-0.5 inline-block max-w-full truncate rounded-full px-2 py-0.5 text-[10px] ${
                      collab ? "bg-primary/10 text-primary" : "bg-violet/10 text-violet"
                    }`}>
                      Re: {collab?.title ?? workshop?.title ?? "Lounge"}
                    </span>
                  )}
                  <p className={`truncate text-xs ${unread > 0 ? "text-ink" : "text-ink-muted"}`}>
                    {lastFromMe && conv.last_message_preview ? (
                      <span className="text-ink-muted">You: </span>
                    ) : null}
                    {conv.last_message_preview ?? "No messages yet"}
                  </p>
                </div>
                {unread > 0 && (
                  <span className="ml-2 inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-coral shadow-[0_0_0_3px_color-mix(in_oklab,var(--coral)_25%,transparent)]" aria-hidden />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <NewMessageDialog open={composeOpen} onOpenChange={setComposeOpen} />
    </main>
  );
}

function EmptyInbox({ onNew }: { onNew: () => void }) {
  return (
    <div className="relative mt-6 overflow-hidden rounded-3xl border border-dashed border-border bg-surface p-10 text-center">
      <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:radial-gradient(circle,var(--ink)_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="relative">
        <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <h3 className="mt-4 font-display text-2xl text-ink md:text-3xl">No conversations yet.</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
          DM your mutuals, or anyone you're connected to through a collab or Lounge.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button onClick={onNew} className="rounded-full gap-1.5">
            <Plus className="h-4 w-4" /> New message
          </Button>
          <Link to="/collab">
            <Button variant="outline" className="rounded-full">Browse the Collab Board</Button>
          </Link>
          <Link to="/groups">
            <Button variant="outline" className="rounded-full">Find your groups</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function avatarInitials(p: ProfileLite | null): string {
  if (!p) return "?";
  const src = (p.display_name ?? p.username ?? "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  if (days < 365) {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });
}

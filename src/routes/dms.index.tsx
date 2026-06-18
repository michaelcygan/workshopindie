import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Search } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/require-auth";
import { PageHeaderCompact } from "@/components/page-header-compact";
import { KickerChip } from "@/components/kicker-chip";
import { EmptySpark } from "@/components/empty-spark";
import { Button } from "@/components/ui/button";

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
};

type Tab = "all" | "unread" | "collabs" | "workshops";

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
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      const { data: convs } = await supabase
        .from("conversations")
        .select("id, user_a, user_b, last_message_at, last_message_preview, context_collab_post_id, context_workshop_id")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .order("last_message_at", { ascending: false, nullsFirst: false });
      const list = (convs ?? []) as ConversationRow[];
      const otherIds = list.map((c) => (c.user_a === user.id ? c.user_b : c.user_a));
      const collabIds = Array.from(new Set(list.map((c) => c.context_collab_post_id).filter(Boolean) as string[]));
      const workshopIds = Array.from(new Set(list.map((c) => c.context_workshop_id).filter(Boolean) as string[]));
      const [{ data: profs }, { data: collabs }, { data: workshops }] = await Promise.all([
        otherIds.length
          ? supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", otherIds)
          : Promise.resolve({ data: [] as ProfileLite[] }),
        collabIds.length
          ? supabase.from("collab_posts").select("id, title, slug").in("id", collabIds)
          : Promise.resolve({ data: [] as CollabLite[] }),
        workshopIds.length
          ? supabase.from("workshops").select("id, title, slug").in("id", workshopIds)
          : Promise.resolve({ data: [] as WorkshopLite[] }),
      ]);
      const byId = new Map<string, ProfileLite>((profs ?? []).map((p) => [p.id, p as ProfileLite]));
      const collabById = new Map<string, CollabLite>((collabs ?? []).map((c) => [c.id, c as CollabLite]));
      const workshopById = new Map<string, WorkshopLite>((workshops ?? []).map((w) => [w.id, w as WorkshopLite]));
      const unreadCounts = new Map<string, number>();
      if (list.length) {
        const { data: unread } = await supabase
          .from("messages")
          .select("conversation_id")
          .in("conversation_id", list.map((c) => c.id))
          .neq("sender_id", user.id)
          .is("read_at", null);
        for (const m of unread ?? []) {
          unreadCounts.set(m.conversation_id, (unreadCounts.get(m.conversation_id) ?? 0) + 1);
        }
      }
      if (cancelled) return;
      setRows(list.map((c) => ({
        conv: c,
        other: byId.get(c.user_a === user.id ? c.user_b : c.user_a) ?? null,
        unread: unreadCounts.get(c.id) ?? 0,
        collab: c.context_collab_post_id ? collabById.get(c.context_collab_post_id) ?? null : null,
        workshop: c.context_workshop_id ? workshopById.get(c.context_workshop_id) ?? null : null,
      })));
      setBusy(false);
    })();
    return () => { cancelled = true; };
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
    { id: "workshops", label: "Workshops", count: counts.workshops },
  ];

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 md:py-8">
      <PageHeaderCompact title="Messages" />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <KickerChip live={counts.unread > 0}>
          {counts.unread > 0 ? `${counts.unread} unread` : "Inbox"}
        </KickerChip>
        <p className="text-sm text-ink-muted">
          {counts.all > 0
            ? `${counts.all} thread${counts.all === 1 ? "" : "s"} · DM mutuals and anyone connected to your collabs.`
            : "DM mutuals — or anyone connected to your collabs and workshops."}
        </p>
      </div>

      {!busy && rows.length > 0 && (
        <>
          <div className="mt-5 flex flex-wrap gap-1.5">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  tab === t.id ? "bg-ink text-background" : "bg-muted text-ink-soft hover:bg-muted/80"
                }`}
              >
                {t.label}
                {t.count > 0 && (
                  <span className={`rounded-full px-1.5 text-[10px] ${tab === t.id ? "bg-background/20" : "bg-background/40 text-ink-muted"}`}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="mt-3 relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or message…"
              className="w-full rounded-full border border-border bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
            />
          </div>
        </>
      )}

      {busy ? (
        <div className="mt-8 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-6">
          <EmptySpark
            title="No conversations yet."
            body="Find people on the Collab Board or in a Group and message them."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link to="/collab">
                  <Button className="rounded-full">Browse the Collab Board</Button>
                </Link>
                <Link to="/groups">
                  <Button variant="outline" className="rounded-full">Find your groups</Button>
                </Link>
              </div>
            }
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-border bg-surface p-6 text-center text-sm text-ink-muted">
          No conversations match.
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-surface">
          {filtered.map(({ conv, other, unread, collab, workshop }) => (
            <li key={conv.id}>
              <Link
                to="/dms/$conversationId"
                params={{ conversationId: conv.id }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60"
              >
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                  {other?.avatar_url ? (
                    <img src={other.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium text-ink">
                      {other?.display_name ?? other?.username ?? "Someone"}
                    </span>
                    {conv.last_message_at && (
                      <span className="shrink-0 text-[11px] text-ink-muted">
                        {new Date(conv.last_message_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {(collab || workshop) && (
                    <span className={`mt-0.5 inline-block max-w-full truncate rounded-full px-2 py-0.5 text-[10px] ${
                      collab ? "bg-primary/10 text-primary" : "bg-violet/10 text-violet"
                    }`}>
                      Re: {collab?.title ?? workshop?.title ?? "Workshop"}
                    </span>
                  )}
                  <p className="truncate text-xs text-ink-muted">{conv.last_message_preview ?? "No messages yet"}</p>
                </div>
                {unread > 0 && (
                  <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1.5 text-[10px] font-semibold text-background">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

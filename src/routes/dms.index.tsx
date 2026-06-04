import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/require-auth";

type ConversationRow = {
  id: string;
  user_a: string;
  user_b: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  context_collab_post_id: string | null;
};

type CollabLite = { id: string; title: string; slug: string };


type ProfileLite = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export const Route = createFileRoute("/dms/")({
  component: () => <RequireAuth><DmsIndex /></RequireAuth>,
  head: () => ({ meta: [{ title: "Messages — Workshop" }] }),
});

function DmsIndex() {
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<Array<{ conv: ConversationRow; other: ProfileLite | null; unread: number; collab: CollabLite | null }>>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      const { data: convs } = await supabase
        .from("conversations")
        .select("id, user_a, user_b, last_message_at, last_message_preview, context_collab_post_id")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .order("last_message_at", { ascending: false, nullsFirst: false });
      const list = (convs ?? []) as ConversationRow[];
      const otherIds = list.map((c) => (c.user_a === user.id ? c.user_b : c.user_a));
      const collabIds = Array.from(new Set(list.map((c) => c.context_collab_post_id).filter(Boolean) as string[]));
      const [{ data: profs }, { data: collabs }] = await Promise.all([
        otherIds.length
          ? supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", otherIds)
          : Promise.resolve({ data: [] as ProfileLite[] }),
        collabIds.length
          ? supabase.from("collab_posts").select("id, title, slug").in("id", collabIds)
          : Promise.resolve({ data: [] as CollabLite[] }),
      ]);
      const byId = new Map<string, ProfileLite>((profs ?? []).map((p) => [p.id, p as ProfileLite]));
      const collabById = new Map<string, CollabLite>((collabs ?? []).map((c) => [c.id, c as CollabLite]));
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
      })));
      setBusy(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);


  if (loading || !user) return null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-3xl text-ink">Messages</h1>
      <p className="mt-1 text-sm text-ink-muted">You can DM anyone you follow each other with.</p>

      {busy ? (
        <div className="mt-8 text-sm text-ink-muted">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-border bg-surface p-8 text-center">
          <MessageCircle className="mx-auto h-8 w-8 text-ink-muted" />
          <p className="mt-3 text-sm text-ink-muted">No conversations yet. Find people on the Collab Board and message them — once you follow each other, you can DM.</p>
          <Link to="/collab" className="mt-4 inline-flex items-center justify-center rounded-full bg-ink px-4 py-2 text-sm font-medium text-background hover:opacity-90">
            Browse the Collab Board
          </Link>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-surface">
          {rows.map(({ conv, other, unread, collab }) => (
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
                  {collab && (
                    <span className="mt-0.5 inline-block max-w-full truncate rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                      Re: {collab.title}
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

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
};

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
  const [rows, setRows] = useState<Array<{ conv: ConversationRow; other: ProfileLite | null; unread: number }>>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      const { data: convs } = await supabase
        .from("conversations")
        .select("id, user_a, user_b, last_message_at, last_message_preview")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .order("last_message_at", { ascending: false, nullsFirst: false });
      const list = (convs ?? []) as ConversationRow[];
      const otherIds = list.map((c) => (c.user_a === user.id ? c.user_b : c.user_a));
      const { data: profs } = otherIds.length
        ? await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", otherIds)
        : { data: [] };
      const byId = new Map<string, ProfileLite>((profs ?? []).map((p) => [p.id, p as ProfileLite]));
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
          <p className="mt-3 text-sm text-ink-muted">No messages yet. Follow people you've collabed with — when they follow back, you can DM.</p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-surface">
          {rows.map(({ conv, other, unread }) => (
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

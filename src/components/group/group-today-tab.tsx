import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send, Trash2, Newspaper, Sparkles, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsMemberOfGroup } from "@/components/join-group-button";
import { Button } from "@/components/ui/button";
import { fetchGroupNews } from "@/lib/group-news.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TodayPost = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  expires_at: string;
  author?: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
};

type GroupRefForToday = {
  id: string;
  slug: string;
  name: string;
};

/**
 * The leftmost tab on a group page. Three lightweight surfaces in one column:
 *  1. **Today chat** — ephemeral messages from group members, auto-expire at
 *     each author's local midnight (trigger sets `expires_at`).
 *  2. **Fresh collabs** — collabs tagged into this group in the last 24h.
 *  3. **News** — optional RSS/Atom feed configured by group admins.
 *
 * All three are read-mostly so a single page query covers them.
 */
export function GroupTodayTab({ group }: { group: GroupRefForToday }) {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <TodayChat group={group} />
      <aside className="space-y-8">
        <FreshCollabs group={group} />
        <TodayNews groupId={group.id} />
      </aside>
    </div>
  );
}

/* ---------- Today chat ---------- */

function TodayChat({ group }: { group: GroupRefForToday }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: isMember } = useIsMemberOfGroup(group.id);
  const [body, setBody] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["group", group.id, "today-posts"],
    queryFn: async (): Promise<TodayPost[]> => {
      const { data, error } = await supabase
        .from("group_today_posts")
        .select(
          "id,author_id,body,created_at,expires_at,author:profiles!group_today_posts_author_id_fkey(username,display_name,avatar_url)",
        )
        .eq("group_id", group.id)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as TodayPost[];
    },
    refetchInterval: 60_000,
  });

  // Realtime: append on insert, drop on delete.
  useEffect(() => {
    const ch = supabase
      .channel(`gtp-${group.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_today_posts", filter: `group_id=eq.${group.id}` },
        () => qc.invalidateQueries({ queryKey: ["group", group.id, "today-posts"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [group.id, qc]);

  // Auto-scroll to bottom when new posts arrive.
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [posts.length]);

  const postFn = useMutation({
    mutationFn: async (text: string) => {
      if (!user) throw new Error("Sign in to post");
      const { error } = await supabase
        .from("group_today_posts")
        .insert({ group_id: group.id, author_id: user.id, body: text } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["group", group.id, "today-posts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("group_today_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["group", group.id, "today-posts"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const canPost = !!user && !!isMember;
  const today = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    [],
  );

  return (
    <section className="rounded-3xl border border-border bg-surface">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="font-display text-lg text-ink">Today in {group.name}</h2>
          <p className="text-xs text-ink-muted">
            {today} · messages clear at midnight, your time.
          </p>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-ink-soft">
          {posts.length}
        </span>
      </header>

      <div
        ref={scrollerRef}
        className="max-h-[55vh] min-h-[280px] space-y-3 overflow-y-auto px-4 py-4"
      >
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-surface-2" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl bg-muted/40 px-4 py-6 text-center text-sm text-ink-muted">
            Nothing yet today. Be the first to say hi.
          </div>
        ) : (
          posts.map((p) => {
            const name = p.author?.display_name ?? p.author?.username ?? "Member";
            const mine = user?.id === p.author_id;
            return (
              <div key={p.id} className="flex gap-2.5">
                {p.author?.avatar_url ? (
                  <img
                    src={p.author.avatar_url}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-8 w-8 shrink-0 rounded-full bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    {p.author?.username ? (
                      <Link
                        to="/u/$username"
                        params={{ username: p.author.username }}
                        className="truncate text-sm font-medium text-ink hover:underline"
                      >
                        {name}
                      </Link>
                    ) : (
                      <span className="truncate text-sm font-medium text-ink">{name}</span>
                    )}
                    <span className="text-[11px] text-ink-muted">
                      {new Date(p.created_at).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm text-ink">{p.body}</p>
                </div>
                {mine && (
                  <button
                    type="button"
                    onClick={() => deletePost.mutate(p.id)}
                    className="text-ink-muted/60 transition hover:text-ink"
                    aria-label="Delete message"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = body.trim();
          if (!t || !canPost) return;
          postFn.mutate(t);
        }}
        className="flex items-center gap-2 border-t border-border px-3 py-2"
      >
        <input
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 500))}
          placeholder={
            !user
              ? "Sign in to chat"
              : !isMember
                ? "Join to chat"
                : "What's happening today?"
          }
          disabled={!canPost || postFn.isPending}
          className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-muted/70 focus:outline-none disabled:opacity-60"
        />
        <span className="text-[11px] tabular-nums text-ink-muted/70">{body.length}/500</span>
        <Button
          type="submit"
          size="sm"
          className={cn("h-8 gap-1 rounded-full", body.trim() ? "" : "opacity-50")}
          disabled={!canPost || !body.trim() || postFn.isPending}
        >
          <Send className="h-3.5 w-3.5" />
          Send
        </Button>
      </form>
    </section>
  );
}

/* ---------- Fresh collabs (today) ---------- */

function FreshCollabs({ group }: { group: GroupRefForToday }) {
  const since = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() - 24);
    return d.toISOString();
  }, []);

  const { data: rows = [] } = useQuery({
    queryKey: ["group", group.id, "fresh-collabs", since],
    queryFn: async () => {
      const { data } = await supabase
        .from("group_collabs")
        .select(
          "added_at,collab:collab_posts(id,title,slug,description,status,created_at)",
        )
        .eq("group_id", group.id)
        .gte("added_at", since)
        .order("added_at", { ascending: false })
        .limit(8);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []).map((r: any) => r.collab).filter((c: any) => c && c.status === "open") as Array<{
        id: string;
        title: string;
        slug: string;
        description: string | null;
      }>;
    },
  });

  return (
    <section className="rounded-3xl border border-border bg-surface p-4">
      <header className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="font-display text-base text-ink">Fresh collabs</h3>
      </header>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Nothing new in the last 24h.{" "}
          <Link
            to="/collab/new"
            search={{ group: group.slug }}
            className="font-medium text-ink underline"
          >
            Post one →
          </Link>
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((c) => (
            <li key={c.id}>
              <Link
                to="/collab/$slug"
                params={{ slug: c.slug }}
                className="block rounded-xl border border-border/60 p-2.5 transition hover:bg-muted/50"
              >
                <div className="line-clamp-1 text-sm font-medium text-ink">{c.title}</div>
                {c.description && (
                  <div className="line-clamp-1 text-xs text-ink-muted">{c.description}</div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------- Today news (optional RSS) ---------- */

function TodayNews({ groupId }: { groupId: string }) {
  const fetchNews = useServerFn(fetchGroupNews);
  const { data, isLoading } = useQuery({
    queryKey: ["group", groupId, "news"],
    queryFn: () => fetchNews({ data: { group_id: groupId, limit: 5 } }),
    staleTime: 30 * 60 * 1000,
  });
  const items = data?.items ?? [];
  if (!isLoading && items.length === 0) return null;

  return (
    <section className="rounded-3xl border border-border bg-surface p-4">
      <header className="mb-3 flex items-center gap-2">
        <Newspaper className="h-4 w-4 text-ink-muted" />
        <h3 className="font-display text-base text-ink">In the news</h3>
      </header>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded-md bg-surface-2" />
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((n, i) => (
            <li key={i}>
              <a
                href={n.link}
                target="_blank"
                rel="noopener noreferrer ugc"
                className="group flex items-start gap-1.5 text-sm text-ink hover:underline"
              >
                <span className="line-clamp-2">{n.title}</span>
                <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-ink-muted opacity-0 transition group-hover:opacity-100" />
              </a>
              {n.published_at && (
                <div className="text-[11px] text-ink-muted">
                  {new Date(n.published_at).toLocaleDateString()}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

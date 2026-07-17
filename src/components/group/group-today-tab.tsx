import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send, Trash2, Sparkles, ArrowRight, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsMemberOfGroup } from "@/components/join-group-button";
import { Button } from "@/components/ui/button";
import { GroupNextEvent } from "@/components/group/group-next-event";
import { TodayMentionPopover } from "@/components/group/today-mention-popover";
import { renderTodayBody } from "@/lib/today-text";
import { postTodayMessage } from "@/lib/today-chat.functions";
import { CATEGORY_LABELS, type Category } from "@/lib/categories";
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
 * Today tab — modernized layout.
 *  Left  : ephemeral chat (auto-expires 24h).
 *  Right : Next event · Recent collabs · Recent works.
 */
export function GroupTodayTab({ group }: { group: GroupRefForToday }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <TodayChat group={group} />
      <aside className="space-y-4">
        <GroupNextEvent group={group} />
        <RecentCollabs group={group} />
        <RecentWorks group={group} />
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
  const inputRef = useRef<HTMLInputElement>(null);
  const postFn = useServerFn(postTodayMessage);

  // Mention popover state.
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);

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

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [posts.length]);

  const post = useMutation({
    mutationFn: async (text: string) => {
      await postFn({ data: { groupId: group.id, body: text } });
    },
    onSuccess: () => {
      setBody("");
      setMention(null);
      qc.invalidateQueries({ queryKey: ["group", group.id, "today-posts"] });
    },
    onError: (e: Error) => {
      console.error("[today-post] client", e);
      toast.error(e?.message || "Could not post message.");
    },
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
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    [],
  );

  // Detect "@<query>" being typed near the caret to drive the popover.
  function recalcMention(value: string, caret: number) {
    let i = caret - 1;
    while (i >= 0) {
      const ch = value[i];
      if (ch === "@") {
        const prev = i > 0 ? value[i - 1] : "";
        if (i === 0 || /\s/.test(prev)) {
          const query = value.slice(i + 1, caret);
          if (/^[a-zA-Z0-9_]{0,30}$/.test(query)) {
            setMention({ start: i, query });
            return;
          }
        }
        break;
      }
      if (/\s/.test(ch)) break;
      i -= 1;
    }
    setMention(null);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.slice(0, 500);
    setBody(v);
    recalcMention(v, e.target.selectionStart ?? v.length);
  }

  function handlePickMention(insert: string) {
    if (!mention) return;
    const before = body.slice(0, mention.start);
    const after = body.slice(mention.start + 1 + mention.query.length);
    const sep = after.startsWith(" ") || after === "" ? "" : " ";
    const next = `${before}${insert}${sep}${after}`.slice(0, 500);
    setBody(next);
    setMention(null);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      const caret = before.length + insert.length + sep.length;
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }

  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-surface">
      <header className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="truncate font-display text-base text-ink">Today in {group.name}</h2>
        </div>
        <span
          title="Messages clear 24 hours after posting"
          className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-ink-soft"
        >
          {today} · {posts.length}
        </span>
      </header>

      <div
        ref={scrollerRef}
        className="h-[clamp(240px,36vh,380px)] space-y-3 overflow-y-auto px-4 py-3 xl:h-[46vh]"
      >
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/40" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <p className="text-center text-sm text-ink-muted">Nothing yet today. Be the first to say hi.</p>
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
                  <p className="whitespace-pre-wrap break-words text-sm text-ink">
                    {renderTodayBody(p.body)}
                  </p>
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
          post.mutate(t);
        }}
        className="relative flex items-center gap-2 border-t border-border/60 px-3 py-2"
      >
        {canPost && (
          <TodayMentionPopover
            open={mention !== null}
            query={mention?.query ?? ""}
            groupId={group.id}
            onPick={handlePickMention}
            onClose={() => setMention(null)}
          />
        )}
        <input
          ref={inputRef}
          value={body}
          onChange={handleChange}
          onKeyUp={(e) => {
            const el = e.currentTarget;
            recalcMention(el.value, el.selectionStart ?? el.value.length);
          }}
          onClick={(e) => {
            const el = e.currentTarget;
            recalcMention(el.value, el.selectionStart ?? el.value.length);
          }}
          placeholder={
            !user
              ? "Sign in to chat"
              : !isMember
                ? "Join to chat"
                : "What's happening? Use @ to tag people, collabs, groups, or events."
          }
          disabled={!canPost || post.isPending}
          className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-muted/70 focus:outline-none disabled:opacity-60"
        />
        <span className="text-[11px] tabular-nums text-ink-muted/70">{body.length}/500</span>
        <Button
          type="submit"
          size="sm"
          className={cn("h-8 gap-1 rounded-full", body.trim() ? "" : "opacity-50")}
          disabled={!canPost || !body.trim() || post.isPending}
        >
          <Send className="h-3.5 w-3.5" />
          Send
        </Button>
      </form>
    </section>
  );
}

/* ---------- Sidebar section shell ---------- */

function SidebarCard({
  icon: Icon,
  label,
  children,
  footer,
}: {
  icon: typeof Sparkles;
  label: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-surface p-3.5">
      <header className="mb-2.5 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-ink-muted" />
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{label}</h3>
      </header>
      {children}
      {footer && <div className="mt-2.5">{footer}</div>}
    </section>
  );
}

function SeeAllLink({ group, tab, label }: { group: GroupRefForToday; tab: "collab" | "work"; label: string }) {
  return (
    <Link
      to="/g/$slug"
      params={{ slug: group.slug }}
      search={{ t: tab } as never}
      className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-soft hover:text-ink"
    >
      {label} <ArrowRight className="h-3 w-3" />
    </Link>
  );
}

/* ---------- Recent collabs ---------- */

type RecentCollabRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  category: Category | null;
  author: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
};

function RecentCollabs({ group }: { group: GroupRefForToday }) {
  const { data: collabs = [], isLoading } = useQuery({
    queryKey: ["group", group.id, "today-recent-collabs"],
    queryFn: async (): Promise<RecentCollabRow[]> => {
      const { data } = await supabase
        .from("group_collabs")
        .select(
          "added_at,collab:collab_posts(id,title,slug,status,category,author:profiles!collab_posts_user_id_fkey(username,display_name,avatar_url))",
        )
        .eq("group_id", group.id)
        .order("added_at", { ascending: false })
        .limit(12);
      return (data ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r.collab)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((c: any) => c && c.status === "open")
        .slice(0, 5) as RecentCollabRow[];
    },
    staleTime: 60_000,
  });

  return (
    <SidebarCard
      icon={Sparkles}
      label="Recent collabs"
      footer={<SeeAllLink group={group} tab="collab" label="See all collabs" />}
    >
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/40" />
          ))}
        </div>
      ) : collabs.length === 0 ? (
        <p className="text-xs text-ink-muted">No open collabs yet.</p>
      ) : (
        <ul className="space-y-1">
          {collabs.map((c) => {
            const name = c.author?.display_name ?? c.author?.username ?? "Member";
            return (
              <li key={c.id}>
                <Link
                  to="/collab/$slug"
                  params={{ slug: c.slug }}
                  className="block rounded-lg px-2 py-1.5 transition hover:bg-muted/50"
                >
                  <div className="line-clamp-1 text-sm font-medium text-ink">{c.title}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-muted">
                    <span className="truncate">by {name}</span>
                    {c.category && CATEGORY_LABELS[c.category] && (
                      <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-ink-soft">
                        {CATEGORY_LABELS[c.category]}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SidebarCard>
  );
}

/* ---------- Recent works ---------- */

type RecentWorkRow = {
  id: string;
  title: string;
  slug: string;
  cover_url: string | null;
  category: Category | null;
  published_at: string | null;
  author: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
};

function RecentWorks({ group }: { group: GroupRefForToday }) {
  const { data: works = [], isLoading } = useQuery({
    queryKey: ["group", group.id, "today-recent-works"],
    queryFn: async (): Promise<RecentWorkRow[]> => {
      const { data } = await supabase
        .from("group_works")
        .select(
          "created_at,work:works(id,title,slug,cover_url,category,published_at,author:profiles!works_created_by_fkey(username,display_name,avatar_url))",
        )
        .eq("group_id", group.id)
        .order("created_at", { ascending: false })
        .limit(12);
      return (data ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r.work)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((w: any) => !!w && w.published_at)
        .slice(0, 5) as RecentWorkRow[];
    },
    staleTime: 60_000,
  });

  return (
    <SidebarCard
      icon={ImageIcon}
      label="Recent works"
      footer={<SeeAllLink group={group} tab="work" label="See all works" />}
    >
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/40" />
          ))}
        </div>
      ) : works.length === 0 ? (
        <p className="text-xs text-ink-muted">No works tagged yet.</p>
      ) : (
        <ul className="space-y-1">
          {works.map((w) => {
            const name = w.author?.display_name ?? w.author?.username ?? "Member";
            return (
              <li key={w.id}>
                <Link
                  to="/works/$slug"
                  params={{ slug: w.slug }}
                  className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition hover:bg-muted/50"
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                    {w.cover_url ? (
                      <img src={w.cover_url} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-1 text-sm font-medium text-ink">{w.title}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-muted">
                      <span className="truncate">by {name}</span>
                      {w.category && CATEGORY_LABELS[w.category] && (
                        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-ink-soft">
                          {CATEGORY_LABELS[w.category]}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SidebarCard>
  );
}

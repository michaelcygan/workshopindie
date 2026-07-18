import { useEffect, useMemo, useRef, useState } from "react";
import { TODAY_PROMPTS, sampleN } from "@/lib/today-prompts";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send, Trash2, Sparkles, ArrowRight, Image as ImageIcon, Maximize2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsMemberOfGroup } from "@/components/join-group-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { GroupNextEvent } from "@/components/group/group-next-event";
import { TodayMentionPopover } from "@/components/group/today-mention-popover";
import { renderTodayBody } from "@/lib/today-text";
import { postTodayMessage } from "@/lib/today-chat.functions";
import { CATEGORY_LABELS, type Category } from "@/lib/categories";
import { ProfilePeek } from "@/components/profile-peek";
import { CollabPeek } from "@/components/collab-peek";
import { WorkPeek } from "@/components/work-peek";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TodayPresenceBubbles } from "@/components/group/today-presence-bubbles";
import { useAdjacentGroups } from "@/components/adjacent-groups-rail";


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
    <div className="space-y-4">
      <TodayChat group={group} />
      <TodayModuleRail group={group} />
    </div>
  );
}

/* ---------- Swipeable module rail ---------- */

function TodayModuleRail({ group }: { group: GroupRefForToday }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, []);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.9), behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="w-[85%] shrink-0 snap-start sm:w-[320px]">
          <GroupNextEvent group={group} />
        </div>
        <div className="w-[85%] shrink-0 snap-start sm:w-[320px]">
          <RecentCollabs group={group} />
        </div>
        <div className="w-[85%] shrink-0 snap-start sm:w-[320px]">
          <RecentWorks group={group} />
        </div>
        <AdjacentScenesCard groupId={group.id} />

      </div>
      {canLeft && (
        <button
          type="button"
          aria-label="Scroll left"
          onClick={() => scrollBy(-1)}
          className="absolute left-1 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-surface/95 shadow-sm hover:bg-surface md:flex"
        >
          <ArrowRight className="h-4 w-4 rotate-180 text-ink-soft" />
        </button>
      )}
      {canRight && (
        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => scrollBy(1)}
          className="absolute right-1 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-surface/95 shadow-sm hover:bg-surface md:flex"
        >
          <ArrowRight className="h-4 w-4 text-ink-soft" />
        </button>
      )}
    </div>
  );
}

/* ---------- Today chat ---------- */

function TodayChat({ group, expanded = false }: { group: GroupRefForToday; expanded?: boolean }) {
  const [showExpanded, setShowExpanded] = useState(false);

  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: isMember } = useIsMemberOfGroup(group.id);
  const [body, setBody] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const postFn = useServerFn(postTodayMessage);

  // Mention popover state.
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);

  const { data: posts = [], isLoading, error: postsError, refetch: refetchPosts } = useQuery({
    queryKey: ["group", group.id, "today-posts"],
    enabled: !!user,
    queryFn: async (): Promise<TodayPost[]> => {
      const { data, error } = await supabase
        .from("group_today_posts")
        .select(
          "id,author_id,body,created_at,expires_at,author:profiles!group_today_posts_author_profile_fkey(username,display_name,avatar_url)",
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
    <section className={cn(
      "flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-surface",
      expanded ? "h-full" : "h-[clamp(360px,52vh,560px)]",
    )}>
      <header className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <h2 className="truncate font-display text-base text-ink">Today in {group.name}</h2>
          <TodayPresenceBubbles groupId={group.id} />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!expanded && user && (
            <button
              type="button"
              onClick={() => setShowExpanded(true)}
              aria-label="Expand chat"
              title="Expand chat"
              className="grid h-7 w-7 place-items-center rounded-full text-ink-soft transition hover:bg-muted hover:text-ink"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
          <span
            title="Messages clear 24 hours after posting"
            className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-ink-soft"
          >
            {today}
          </span>
        </div>
      </header>

      {!expanded && (
        <Dialog open={showExpanded} onOpenChange={setShowExpanded}>
          <DialogContent className="h-[85vh] max-w-3xl gap-0 overflow-hidden p-0">
            <DialogTitle className="sr-only">Today in {group.name}</DialogTitle>
            <TodayChat group={group} expanded />
          </DialogContent>
        </Dialog>
      )}



      {!user ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center">
          <p className="text-sm text-ink-soft">
            Sign in to see what's happening in {group.name} today.
          </p>
          <Link
            to="/login"
            search={{ redirect: typeof window !== "undefined" ? window.location.pathname + window.location.search : `/g/${group.slug}` }}
            className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Sign in
          </Link>
        </div>
      ) : (
      <>
      <div
        ref={scrollerRef}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-3 min-h-0"
      >


        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/40" />
            ))}
          </div>
        ) : postsError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <p className="text-destructive">Couldn't load the board.</p>
            <p className="mt-1 text-xs text-ink-muted">{(postsError as Error)?.message ?? "Unknown error"}</p>
            <button
              type="button"
              onClick={() => refetchPosts()}
              className="mt-2 rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-2"
            >
              Retry
            </button>
          </div>
        ) : posts.length === 0 ? (
          <p className="text-center text-sm text-ink-muted">Nothing yet today. Be the first to say hi.</p>

        ) : (
          posts.map((p) => {
            const name = p.author?.display_name ?? p.author?.username ?? "Member";
            const mine = user?.id === p.author_id;
            return (
              <div key={p.id} className="flex gap-2.5">
                <ProfilePeek userId={p.author_id}>
                  {p.author?.avatar_url ? (
                    <img
                      src={p.author.avatar_url}
                      alt=""
                      className="h-8 w-8 shrink-0 cursor-pointer rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-8 w-8 shrink-0 cursor-pointer rounded-full bg-muted" />
                  )}
                </ProfilePeek>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <ProfilePeek userId={p.author_id}>
                      <button
                        type="button"
                        className="truncate text-sm font-medium text-ink hover:underline"
                      >
                        {name}
                      </button>
                    </ProfilePeek>
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

      <SuggestedPrompts
        posts={posts}
        canPost={canPost}
        onPick={(text) => {
          setBody(text.slice(0, 500));
          requestAnimationFrame(() => {
            const el = inputRef.current;
            if (!el) return;
            el.focus();
            const end = el.value.length;
            el.setSelectionRange(end, end);
          });
        }}
      />

      <form

        onSubmit={(e) => {
          e.preventDefault();
          const t = body.trim();
          if (!t || !canPost) return;
          post.mutate(t);
        }}
        className="relative shrink-0 border-t border-border/60 bg-surface px-3 py-2.5"
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
        <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background px-3.5 py-1.5 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15">
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
          <span className="hidden text-[11px] tabular-nums text-ink-muted/70 sm:inline">{body.length}/500</span>
          <Button
            type="submit"
            size="sm"
            className={cn("h-8 gap-1 rounded-full", body.trim() ? "" : "opacity-50")}
            disabled={!canPost || !body.trim() || post.isPending}
          >
            <Send className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Send</span>
          </Button>
        </div>
      </form>
      </>
      )}

    </section>
  );
}

/* ---------- Suggested prompt chips ---------- */

const STALE_MS = 45 * 60 * 1000;

function SuggestedPrompts({
  posts,
  canPost,
  onPick,
}: {
  posts: TodayPost[];
  canPost: boolean;
  onPick: (text: string) => void;
}) {
  const lastAt = posts.length ? new Date(posts[posts.length - 1].created_at).getTime() : 0;
  const isEmpty = posts.length === 0;
  const isStale = !isEmpty && Date.now() - lastAt > STALE_MS;
  const show = canPost && (isEmpty || isStale);

  // Reshuffle when the trigger flips (new empty/stale window).
  const bucket = isEmpty ? "empty" : isStale ? `stale-${Math.floor(lastAt / STALE_MS)}` : "off";
  const suggestions = useMemo(() => sampleN(TODAY_PROMPTS, 5), [bucket]);

  if (!show) return null;

  return (
    <div className="shrink-0 border-t border-border/60 bg-surface/60 px-3 pt-2.5 pb-1">
      <div className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wide text-ink-muted/80">
        Try starting with
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="shrink-0 rounded-full border border-border bg-background px-3 py-1 text-xs text-ink-soft transition hover:border-primary/40 hover:bg-muted hover:text-ink"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
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
  const [peekId, setPeekId] = useState<string | null>(null);
  const [peekOpen, setPeekOpen] = useState(false);
  const { data: collabs = [], isLoading, error, refetch } = useQuery({
    queryKey: ["group", group.id, "today-recent-collabs"],
    queryFn: async (): Promise<RecentCollabRow[]> => {
      const { data, error } = await supabase
        .from("group_collabs")
        .select(
          "created_at,collab:collab_posts!collab_post_id(id,title,slug,status,category,author:profiles!collab_posts_user_id_fkey(username,display_name,avatar_url))",
        )
        .eq("group_id", group.id)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r.collab)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((c: any) => c)
        .slice(0, 5) as RecentCollabRow[];
    },
    staleTime: 60_000,
  });

  return (
    <>
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
      ) : error ? (
        <p className="text-xs text-ink-muted">
          Couldn't load.{" "}
          <button type="button" onClick={() => refetch()} className="underline hover:text-ink">
            Retry
          </button>
        </p>
      ) : collabs.length === 0 ? (
        <p className="text-xs text-ink-muted">No collabs yet.</p>

      ) : (
        <ul className="space-y-1">
          {collabs.map((c) => {
            const name = c.author?.display_name ?? c.author?.username ?? "Member";
            const showStatus = c.status && c.status !== "open";
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setPeekId(c.id);
                    setPeekOpen(true);
                  }}
                  className="block w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-muted/50"
                >
                  <div className="line-clamp-1 text-sm font-medium text-ink">{c.title}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-muted">
                    <span className="truncate">by {name}</span>
                    {c.category && CATEGORY_LABELS[c.category] && (
                      <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-ink-soft">
                        {CATEGORY_LABELS[c.category]}
                      </span>
                    )}
                    {showStatus && (
                      <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] capitalize text-ink-soft">
                        {c.status}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </SidebarCard>
    <CollabPeek collabId={peekId} open={peekOpen} onOpenChange={setPeekOpen} />
    </>
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
  const [peekId, setPeekId] = useState<string | null>(null);
  const [peekOpen, setPeekOpen] = useState(false);
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
    <>
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
                <button
                  type="button"
                  onClick={() => {
                    setPeekId(w.id);
                    setPeekOpen(true);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition hover:bg-muted/50"
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
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </SidebarCard>
    <WorkPeek workId={peekId} open={peekOpen} onOpenChange={setPeekOpen} />
    </>
  );
}

/* ---------- Adjacent scenes rail card ---------- */

function AdjacentScenesCard({ groupId }: { groupId: string }) {
  const { data = [], isLoading } = useAdjacentGroups(groupId);
  if (!isLoading && data.length === 0) return null;
  const top = data.slice(0, 5);
  return (
    <div className="w-[85%] shrink-0 snap-start sm:w-[320px]">
      <section className="rounded-2xl border border-border/60 bg-surface p-3.5">
        <header className="mb-2.5 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-ink-muted" />
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
            Adjacent scenes
          </h3>
        </header>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-muted/40" />
            ))}
          </div>
        ) : (
          <ul className="space-y-1">
            {top.map((g) => (
              <li key={g.id}>
                <Link
                  to="/g/$slug"
                  params={{ slug: g.slug }}
                  className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition hover:bg-muted/50"
                >
                  <div
                    className="h-8 w-8 shrink-0 rounded-full bg-muted bg-cover bg-center"
                    style={g.avatar_url ? { backgroundImage: `url(${g.avatar_url})` } : undefined}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-1 text-sm font-medium text-ink">{g.name}</div>
                    {typeof g.member_count === "number" && (
                      <div className="text-[11px] text-ink-muted">
                        {g.member_count.toLocaleString()} member{g.member_count === 1 ? "" : "s"}
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

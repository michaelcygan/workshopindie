import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send, Trash2, Sparkles, Pin, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsMemberOfGroup } from "@/components/join-group-button";
import { Button } from "@/components/ui/button";
import { GroupTodayPinPicker } from "@/components/group/group-today-pin-picker";
import { GroupNextEvent } from "@/components/group/group-next-event";
import { TodayMentionPopover } from "@/components/group/today-mention-popover";
import { renderTodayBody } from "@/lib/today-text";
import { postTodayMessage } from "@/lib/today-chat.functions";
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
 * Today tab — three lightweight surfaces:
 *  1. Today chat — ephemeral messages, auto-expire at author's local midnight.
 *  2. Fresh collabs — member-pinned today + recent 24h fallback.
 *
 * News headlines are shown as a ticker above the tab bar (see
 * `GroupNewsTicker`) so they're visible on every tab, not only here.
 */
export function GroupTodayTab({ group }: { group: GroupRefForToday }) {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <TodayChat group={group} />
      <aside className="space-y-6">
        <GroupNextEvent group={group} />
        <FreshCollabs group={group} />
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

/* ---------- Fresh collabs (pinned + recent) ---------- */

type PinnedRow = {
  user_id: string;
  collab_id: string;
  collab: { id: string; title: string; slug: string; status: string } | null;
  user: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
};

type RecentCollab = { id: string; title: string; slug: string; description: string | null };

function FreshCollabs({ group }: { group: GroupRefForToday }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: isMember } = useIsMemberOfGroup(group.id);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Pinned today.
  const { data: pinned = [] } = useQuery({
    queryKey: ["group", group.id, "today-pins"],
    queryFn: async (): Promise<PinnedRow[]> => {
      const { data, error } = await supabase
        .from("group_today_pins")
        .select(
          "user_id,collab_id,collab:collab_posts!group_today_pins_collab_id_fkey(id,title,slug,status),user:profiles!group_today_pins_user_id_fkey(username,display_name,avatar_url)",
        )
        .eq("group_id", group.id)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as PinnedRow[];
    },
    refetchInterval: 60_000,
  });

  // Realtime invalidate.
  useEffect(() => {
    const ch = supabase
      .channel(`gtp-pins-${group.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_today_pins", filter: `group_id=eq.${group.id}` },
        () => qc.invalidateQueries({ queryKey: ["group", group.id, "today-pins"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [group.id, qc]);

  const since = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() - 24);
    return d.toISOString();
  }, []);
  const pinnedIds = useMemo(() => new Set(pinned.map((p) => p.collab_id)), [pinned]);

  const { data: recent = [] } = useQuery({
    queryKey: ["group", group.id, "fresh-collabs", since],
    queryFn: async (): Promise<RecentCollab[]> => {
      const { data } = await supabase
        .from("group_collabs")
        .select("added_at,collab:collab_posts(id,title,slug,description,status,created_at)")
        .eq("group_id", group.id)
        .gte("added_at", since)
        .order("added_at", { ascending: false })
        .limit(8);
      return (data ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r.collab)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((c: any) => c && c.status === "open") as RecentCollab[];
    },
  });

  const recentFiltered = recent.filter((c) => !pinnedIds.has(c.id)).slice(0, 5);

  const unpin = useMutation({
    mutationFn: async (collabId: string) => {
      if (!user) throw new Error("Sign in");
      const { error } = await supabase
        .from("group_today_pins")
        .delete()
        .eq("group_id", group.id)
        .eq("user_id", user.id)
        .eq("collab_id", collabId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["group", group.id, "today-pins"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const empty = pinned.length === 0 && recentFiltered.length === 0;

  return (
    <section className="rounded-3xl border border-border bg-surface p-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-display text-base text-ink">Fresh collabs</h3>
        </div>
        {user && isMember && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 rounded-full px-2 text-xs"
            onClick={() => setPickerOpen(true)}
          >
            <Pin className="h-3.5 w-3.5" />
            Pin
          </Button>
        )}
      </header>

      {empty ? (
        <p className="text-sm text-ink-muted">
          {user && isMember ? (
            <>
              Pin one of your active collabs so the group sees it today.{" "}
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="font-medium text-ink underline"
              >
                Pin one →
              </button>
            </>
          ) : (
            <>
              Nothing pinned today.{" "}
              <Link
                to="/collab/new"
                search={{ group: group.slug }}
                className="font-medium text-ink underline"
              >
                Post a collab →
              </Link>
            </>
          )}
        </p>
      ) : (
        <div className="space-y-4">
          {pinned.length > 0 && (
            <ul className="space-y-2">
              {pinned.map((p) => {
                if (!p.collab) return null;
                const name = p.user?.display_name ?? p.user?.username ?? "Member";
                const mine = user?.id === p.user_id;
                return (
                  <li key={`${p.user_id}-${p.collab_id}`} className="group/pin relative">
                    <Link
                      to="/collab/$slug"
                      params={{ slug: p.collab.slug }}
                      className="block rounded-xl border border-primary/30 bg-primary/5 p-2.5 transition hover:bg-primary/10"
                    >
                      <div className="flex items-center gap-1.5">
                        <Pin className="h-3 w-3 text-primary" />
                        <span className="line-clamp-1 text-sm font-medium text-ink">
                          {p.collab.title}
                        </span>
                      </div>
                      <div className="mt-0.5 line-clamp-1 text-[11px] text-ink-muted">
                        by {name}
                      </div>
                    </Link>
                    {mine && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          unpin.mutate(p.collab_id);
                        }}
                        aria-label="Unpin"
                        className="absolute right-1.5 top-1.5 rounded-full p-1 text-ink-muted opacity-0 transition hover:bg-background hover:text-ink group-hover/pin:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {recentFiltered.length > 0 && (
            <div>
              {pinned.length > 0 && (
                <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                  Recent
                </div>
              )}
              <ul className="space-y-2">
                {recentFiltered.map((c) => (
                  <li key={c.id}>
                    <Link
                      to="/collab/$slug"
                      params={{ slug: c.slug }}
                      className="block rounded-xl border border-border/60 p-2.5 transition hover:bg-muted/50"
                    >
                      <div className="line-clamp-1 text-sm font-medium text-ink">
                        {c.title}
                      </div>
                      {c.description && (
                        <div className="line-clamp-1 text-xs text-ink-muted">
                          {c.description}
                        </div>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <GroupTodayPinPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        groupId={group.id}
      />
    </section>
  );
}

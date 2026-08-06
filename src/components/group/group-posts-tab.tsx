import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listPostsByAuthors } from "@/lib/blog.functions";
import { listBlogPostsForEntity } from "@/lib/blog-entity-tags.functions";
import { BlogPostPeek } from "@/components/blog-post-peek";
import { cn } from "@/lib/utils";

type GroupPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  author_name: string;
  published_at: string | null;
  author_profile_ids: string[];
  /** Explicitly tagged to this Group via blog_post_entity_tags. */
  tagged: boolean;
};

type MemberLite = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const s = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * The single Blog surface for a Group: posts explicitly tagged to the Group
 * first, then posts published by its members. De-duplicated by post id.
 * Shared with the route so the tab can be hidden when there is nothing to show.
 */
export function useGroupBlogPosts(groupId: string) {
  const fetchByAuthors = useServerFn(listPostsByAuthors);
  const fetchTagged = useServerFn(listBlogPostsForEntity);

  const membersQuery = useQuery({
    queryKey: ["group", groupId, "post-members"],
    queryFn: async (): Promise<MemberLite[]> => {
      const { data: gm } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId)
        .limit(30);
      const ids = (gm ?? []).map((r) => r.user_id as string);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url")
        .in("id", ids);
      return (profs ?? []).map((p) => ({
        user_id: p.id as string,
        display_name: p.display_name as string | null,
        username: p.username as string | null,
        avatar_url: p.avatar_url as string | null,
      }));
    },
    staleTime: 60_000,
  });

  const members = membersQuery.data ?? [];
  const profileIds = useMemo(
    () => Array.from(new Set(members.map((m) => m.user_id))).sort(),
    [members],
  );

  const postsQuery = useQuery({
    queryKey: ["group", groupId, "blog-posts", profileIds],
    enabled: !membersQuery.isLoading,
    staleTime: 60_000,
    queryFn: async (): Promise<GroupPost[]> => {
      const [tagged, byAuthors] = await Promise.all([
        // Trusted only: a Group page echoes its own stewards and Workshop
        // editorial, not anyone who happened to tag the group.
        fetchTagged({ data: { kind: "group" as const, entityId: groupId, limit: 6, trustedOnly: true } }),
        profileIds.length > 0
          ? fetchByAuthors({ data: { profileIds, limit: 40 } })
          : Promise.resolve([]),
      ]);

      const out: GroupPost[] = [];
      const seen = new Set<string>();
      for (const p of (tagged ?? []) as GroupPost[]) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        out.push({ ...p, author_profile_ids: p.author_profile_ids ?? [], tagged: true });
      }
      const rest: GroupPost[] = [];
      for (const p of (byAuthors ?? []) as GroupPost[]) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        rest.push({ ...p, author_profile_ids: p.author_profile_ids ?? [], tagged: false });
      }
      rest.sort(
        (a, b) =>
          new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime(),
      );
      return [...out, ...rest];
    },
  });

  return {
    members,
    posts: postsQuery.data ?? [],
    isLoading: membersQuery.isLoading || postsQuery.isLoading,
  };
}

export function GroupPostsTab({ group }: { group: { id: string } }) {
  const { members, posts, isLoading } = useGroupBlogPosts(group.id);
  const [authorFilter, setAuthorFilter] = useState<string | null>(null);
  const [peekSlug, setPeekSlug] = useState<string | null>(null);

  const authorsWithPosts = useMemo(() => {
    const ids = new Set<string>();
    for (const p of posts) for (const a of p.author_profile_ids) ids.add(a);
    return members.filter((m) => ids.has(m.user_id));
  }, [posts, members]);

  const filtered = authorFilter
    ? posts.filter((p) => p.author_profile_ids.includes(authorFilter))
    : posts;

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-surface-2" />;
  }

  if (posts.length === 0) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-border bg-surface px-6 py-10 text-center">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-muted/60 text-ink-muted">
          <FileText className="h-4 w-4" />
        </div>
        <h3 className="mt-3 font-display text-base text-ink">No posts yet</h3>
        <p className="mt-1 max-w-xs text-sm text-ink-muted">
          When members of this Group publish on Workshop, their posts land here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface">
      {authorsWithPosts.length >= 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border/60 px-3 py-2 md:px-4">
          <button
            type="button"
            onClick={() => setAuthorFilter(null)}
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition",
              authorFilter === null ? "bg-ink text-background" : "text-ink-muted hover:bg-muted/60 hover:text-ink",
            )}
          >
            All
          </button>
          {authorsWithPosts.map((a) => {
            const name = a.display_name || a.username || "Member";
            const active = authorFilter === a.user_id;
            return (
              <button
                key={a.user_id}
                type="button"
                onClick={() => setAuthorFilter(active ? null : a.user_id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium transition",
                  active ? "bg-ink text-background" : "text-ink-muted hover:bg-muted/60 hover:text-ink",
                )}
                title={name}
              >
                {a.avatar_url ? (
                  <img src={a.avatar_url} alt="" className="h-4 w-4 rounded-full object-cover" />
                ) : (
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-muted text-[8px] text-ink">
                    {initials(name)}
                  </span>
                )}
                <span className="max-w-[10ch] truncate">{name}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="p-3 md:p-4">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">No posts by this author yet.</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setPeekSlug(p.slug)}
                  className="group flex h-full w-full items-start gap-3 rounded-2xl border border-border bg-background p-3 text-left transition hover:border-border-strong hover:shadow-soft"
                >
                  {p.cover_image_url ? (
                    <img
                      src={p.cover_image_url}
                      alt={p.cover_image_alt ?? ""}
                      className="h-14 w-14 shrink-0 rounded-lg object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-muted/60 text-ink-muted">
                      <FileText className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {p.tagged && (
                      <span className="mb-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-ink-soft">
                        About this Group
                      </span>
                    )}
                    <div className="line-clamp-2 font-display text-sm text-ink group-hover:underline">
                      {p.title}
                    </div>
                    {p.excerpt && (
                      <p className="mt-0.5 line-clamp-1 text-[13px] text-ink-soft">{p.excerpt}</p>
                    )}
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-muted">
                      <span className="truncate">{p.author_name}</span>
                      {p.published_at && (
                        <>
                          <span aria-hidden>·</span>
                          <span>{timeAgo(p.published_at)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <BlogPostPeek
        slug={peekSlug}
        open={!!peekSlug}
        onOpenChange={(v) => !v && setPeekSlug(null)}
        onSelectPost={(slug) => setPeekSlug(slug)}
      />
    </div>
  );
}

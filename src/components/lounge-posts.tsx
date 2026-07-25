import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText } from "lucide-react";
import type { ProfileLite } from "@/components/media-panel";
import { listPostsByAuthors } from "@/lib/blog.functions";
import { BlogPostPeek } from "@/components/blog-post-peek";
import { cn } from "@/lib/utils";

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
 * Lounge Posts tab — surfaces published blog posts authored by anyone currently
 * in the room. Clicking a post opens it in a modal so audio/chat continues.
 */
export function LoungePosts({
  participants,
  className,
}: {
  participants: Array<Pick<ProfileLite, "user_id" | "display_name" | "username" | "avatar_url">>;
  className?: string;
}) {
  const fetchPosts = useServerFn(listPostsByAuthors);
  const profileIds = useMemo(
    () => Array.from(new Set(participants.map((p) => p.user_id))).sort(),
    [participants],
  );
  const { data, isLoading } = useQuery({
    queryKey: ["lounge-posts", profileIds],
    queryFn: () => fetchPosts({ data: { profileIds, limit: 40 } }),
    enabled: profileIds.length > 0,
    staleTime: 60_000,
  });

  const [authorFilter, setAuthorFilter] = useState<string | null>(null);
  const [peekSlug, setPeekSlug] = useState<string | null>(null);

  const posts = (data ?? []) as Array<{
    id: string;
    slug: string;
    title: string;
    excerpt: string;
    cover_image_url: string | null;
    cover_image_alt: string | null;
    author_name: string;
    published_at: string | null;
    author_profile_ids: string[];
  }>;

  const authorsWithPosts = useMemo(() => {
    const ids = new Set<string>();
    for (const p of posts) for (const a of p.author_profile_ids) ids.add(a);
    return participants.filter((p) => ids.has(p.user_id));
  }, [posts, participants]);

  const filtered = authorFilter
    ? posts.filter((p) => p.author_profile_ids.includes(authorFilter))
    : posts;

  if (profileIds.length === 0 || (!isLoading && posts.length === 0)) {
    return (
      <div className={cn("flex h-full min-h-[240px] flex-col items-center justify-center px-6 py-10 text-center", className)}>
        <div className="grid h-10 w-10 place-items-center rounded-full bg-muted/60 text-ink-muted">
          <FileText className="h-4 w-4" />
        </div>
        <h3 className="mt-3 font-display text-base text-ink">No posts from this room yet</h3>
        <p className="mt-1 max-w-xs text-sm text-ink-muted">
          When people in the Lounge publish on Workshop, their posts land here.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {authorsWithPosts.length >= 1 && (
        <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-border/60 bg-surface/60 px-3 py-2 md:px-4">
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

      <div className="flex-1 overflow-y-auto p-3 md:p-4">
        {isLoading ? (
          <div className="grid gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted/40" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">No posts by this author yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setPeekSlug(p.slug)}
                  className="group flex w-full items-start gap-3 rounded-2xl border border-border bg-surface p-3 text-left transition hover:border-border-strong hover:shadow-soft"
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

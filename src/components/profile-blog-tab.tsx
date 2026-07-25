import { useEffect, useMemo, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { listProfileBlogPosts } from "@/lib/blog.functions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type Cursor = { published_at: string; id: string } | null;

type ProfileBlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  published_at: string | null;
};

export function ProfileBlogTab({
  profileId,
  username,
  enabled,
  ownerName,
  isOwn,
  onOpenPost,
}: {
  profileId: string;
  username: string;
  enabled: boolean;
  ownerName: string;
  isOwn: boolean;
  onOpenPost: (slug: string) => void;
}) {
  const navigate = useNavigate();
  const fetchPage = useServerFn(listProfileBlogPosts);

  const q = useInfiniteQuery({
    queryKey: ["profile-blog", profileId],
    enabled: enabled && !!profileId,
    initialPageParam: null as Cursor,
    queryFn: ({ pageParam }) =>
      fetchPage({ data: { profileId, cursor: pageParam, limit: 12 } }),
    getNextPageParam: (last) => (last as { nextCursor: Cursor }).nextCursor,
    staleTime: 60_000,
  });

  const pages = q.data?.pages ?? [];
  const posts = useMemo(() => {
    const seen = new Set<string>();
    const out: ProfileBlogPost[] = [];
    for (const p of pages) {
      for (const post of (p as { posts: ProfileBlogPost[] }).posts) {
        if (seen.has(post.id)) continue;
        seen.add(post.id);
        out.push(post);
      }
    }
    return out;
  }, [pages]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !q.hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !q.isFetchingNextPage) q.fetchNextPage();
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [q.hasNextPage, q.isFetchingNextPage, q.fetchNextPage]);

  if (q.isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-[16/10] w-full rounded-2xl" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-surface p-10 text-center">
        <p className="text-ink-muted">{isOwn ? "You haven't been attributed on any published posts yet." : `${ownerName} hasn't been attributed on any published posts.`}</p>
      </div>
    );
  }

  function handleCardClick(e: React.MouseEvent, slug: string) {
    // Preserve middle-click, cmd/ctrl-click, shift-click for real navigation.
    if (e.defaultPrevented) return;
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate({
      to: "/u/$username",
      params: { username },
      search: (prev: Record<string, unknown>) => ({ ...prev, tab: "blog", post: slug }),
    });
    onOpenPost(slug);
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {posts.map((p) => {
          const published = p.published_at ? new Date(p.published_at) : null;
          return (
            <a
              key={p.id}
              href={`/blog/${p.slug}`}
              onClick={(e) => handleCardClick(e, p.slug)}
              className="group block overflow-hidden rounded-2xl border border-border bg-surface transition hover:bg-muted"
            >
              {p.cover_image_url ? (
                <img
                  src={p.cover_image_url}
                  alt={p.cover_image_alt ?? p.title}
                  className="aspect-[16/10] w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="aspect-[16/10] w-full gradient-motion" />
              )}
              <div className="p-3 md:p-4">
                <div className="text-[10px] uppercase tracking-wider text-ink-muted">
                  {published?.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
                <div className="mt-1 font-display text-sm leading-snug text-ink group-hover:underline md:text-base">
                  {p.title}
                </div>
                {p.excerpt && (
                  <p className="mt-1 line-clamp-2 text-xs text-ink-muted md:text-sm">{p.excerpt}</p>
                )}
              </div>
            </a>
          );
        })}
      </div>

      <div ref={sentinelRef} className="h-1" />

      {q.hasNextPage && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => q.fetchNextPage()}
            disabled={q.isFetchingNextPage}
          >
            {q.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </>
  );
}

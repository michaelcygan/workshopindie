import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, PenLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EditorialCard } from "@/components/editorial-card";
import { BlogPostPeek } from "@/components/blog-post-peek";
import { useAuth } from "@/hooks/use-auth";
import type { BlogEntityKind } from "@/lib/blog-entity-tags";
import { listBlogPostsForEntity } from "@/lib/blog-entity-tags.functions";
import { createMyBlogDraft } from "@/lib/blog-member.functions";

type Author = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role_label: string | null;
};

/**
 * Reverse discovery: an editorial rail of published blog posts that tag this
 * entity. Posts open in a peek so readers never lose the entity page.
 * Renders nothing when there are no posts and no write affordance.
 */
export function EntityBlogPosts({
  kind,
  entityId,
  heading = "From the Blog",
  limit = 3,
  className,
  trustedOnly = false,
  canWrite = false,
  writeLabel = "Write about this",
  emptyLabel,
  openSlug,
  onOpenSlugChange,
  layout = "grid",
}: {
  kind: BlogEntityKind;
  entityId: string;
  heading?: string;
  limit?: number;
  className?: string;
  trustedOnly?: boolean;
  canWrite?: boolean;
  writeLabel?: string;
  emptyLabel?: string;
  /** When provided, the peek is driven by the caller (e.g. a URL search param). */
  openSlug?: string | null;
  onOpenSlugChange?: (slug: string | null) => void;
  /** "carousel" swaps the 3-up grid for a swipeable, snap-scrolling rail. */
  layout?: "grid" | "carousel";
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const listFn = useServerFn(listBlogPostsForEntity);
  const createFn = useServerFn(createMyBlogDraft);
  const [localPeekSlug, setLocalPeekSlug] = useState<string | null>(null);

  // Controlled when the caller owns the state (URL-backed), local otherwise.
  const controlled = onOpenSlugChange != null;
  const peekSlug = controlled ? (openSlug ?? null) : localPeekSlug;
  const setPeekSlug = controlled ? onOpenSlugChange! : setLocalPeekSlug;

  const q = useQuery({
    queryKey: ["entity-blog-posts", kind, entityId, limit, trustedOnly],
    queryFn: () => listFn({ data: { kind, entityId, limit, trustedOnly } }),
    staleTime: 60_000,
  });


  const createMut = useMutation({
    mutationFn: () => createFn({ data: { seedTag: { kind, id: entityId } } }),
    onSuccess: (res: { id: string; seedTagFailed?: boolean }) => {
      // Never let a dropped connection pass silently as a successful start.
      if (res.seedTagFailed) {
        toast.warning("Draft created, but the connection didn't save. Add it in Connections.");
      }
      navigate({ to: "/me/blog/$id", params: { id: res.id } });
    },
    onError: (e: Error) => toast.error(e.message),

  });

  const posts = q.data ?? [];
  const showWrite = canWrite && !!user;
  if (posts.length === 0 && !showWrite) return null;

  return (
    <section className={className ?? "mt-8"}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg text-ink">{heading}</h3>
        <div className="flex items-center gap-3">
          {showWrite && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-md gap-1.5"
              disabled={createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              <PenLine className="h-3.5 w-3.5" />
              {createMut.isPending ? "Starting…" : writeLabel}
            </Button>
          )}
          <Link to="/blog" className="text-xs text-ink-muted hover:text-ink">
            All posts →
          </Link>
        </div>
      </div>

      {posts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-ink-muted">
          {emptyLabel ?? "No stories yet. Be the first to write about this."}
        </p>

      ) : (
        <Rail enabled={layout === "carousel"}>
          {posts.map((p) => {
            const authors = ((p as { authors?: Author[] }).authors ?? []).slice(0, 3);
            return (
              <EditorialCard
                key={p.id}
                className={
                  layout === "carousel"
                    ? "w-[78vw] shrink-0 snap-start sm:w-[320px]"
                    : undefined
                }
                cover={p.cover_image_url}
                aspect="16/10"
                onClick={() => setPeekSlug(p.slug)}
                ariaLabel={`Read ${p.title}`}
                eyebrow={
                  p.published_at
                    ? new Date(p.published_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Blog"
                }
                title={p.title}
                dek={p.excerpt}
                meta={
                  authors.length > 0 ? (
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="flex -space-x-2">
                        {authors.map((a) => (
                          <Avatar key={a.id} className="h-5 w-5 border border-surface">
                            {a.avatar_url ? <AvatarImage src={a.avatar_url} alt="" /> : null}
                            <AvatarFallback className="text-[8px]">
                              {(a.display_name || a.username || "?").slice(0, 1).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                      </span>
                      <span className="truncate">
                        {authors.map((a) => a.display_name || a.username).join(", ")}
                      </span>
                    </span>
                  ) : null
                }
              />
            );
          })}
        </Rail>
      )}

      <BlogPostPeek
        slug={peekSlug}
        open={!!peekSlug}
        onOpenChange={(v) => !v && setPeekSlug(null)}
        onSelectPost={(slug) => setPeekSlug(slug)}
      />
    </section>
  );
}

/**
 * A swipeable rail on touch, an arrow-driven scroller on desktop. When
 * disabled it falls back to the original 3-up grid so other entity pages keep
 * their current layout.
 */
function Rail({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    const sync = () => {
      const max = el.scrollWidth - el.clientWidth;
      setEdges({ start: el.scrollLeft > 8, end: el.scrollLeft < max - 8 });
    };
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  }, [enabled, children]);

  if (!enabled) return <div className="grid gap-3 md:grid-cols-3">{children}</div>;

  const nudge = (dir: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.8, 240), behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div
        ref={ref}
        tabIndex={0}
        role="group"
        aria-label="Stories"
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] focus:outline-none [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0"
      >
        {children}
      </div>

      {edges.start && (
        <button
          type="button"
          aria-label="Previous stories"
          onClick={() => nudge(-1)}
          className="absolute left-1 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface/95 text-ink shadow-soft transition hover:bg-surface md:flex"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {edges.end && (
        <button
          type="button"
          aria-label="More stories"
          onClick={() => nudge(1)}
          className="absolute right-1 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface/95 text-ink shadow-soft transition hover:bg-surface md:flex"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

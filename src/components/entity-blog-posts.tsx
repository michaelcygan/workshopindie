import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { PenLine } from "lucide-react";
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
}: {
  kind: BlogEntityKind;
  entityId: string;
  heading?: string;
  limit?: number;
  className?: string;
  trustedOnly?: boolean;
  canWrite?: boolean;
  writeLabel?: string;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const listFn = useServerFn(listBlogPostsForEntity);
  const createFn = useServerFn(createMyBlogDraft);
  const [peekSlug, setPeekSlug] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["entity-blog-posts", kind, entityId, limit, trustedOnly],
    queryFn: () => listFn({ data: { kind, entityId, limit, trustedOnly } }),
    staleTime: 60_000,
  });

  const createMut = useMutation({
    mutationFn: () => createFn({ data: { seedTag: { kind, id: entityId } } }),
    onSuccess: (res: { id: string }) => navigate({ to: "/me/blog/$id", params: { id: res.id } }),
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
              className="rounded-full gap-1.5"
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
          No stories yet. Be the first to write about this.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {posts.map((p) => {
            const authors = ((p as { authors?: Author[] }).authors ?? []).slice(0, 3);
            return (
              <EditorialCard
                key={p.id}
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
        </div>
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

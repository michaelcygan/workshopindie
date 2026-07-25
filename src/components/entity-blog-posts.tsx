import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import type { BlogEntityKind } from "@/lib/blog-entity-tags";
import { listBlogPostsForEntity } from "@/lib/blog-entity-tags.functions";

/**
 * Reverse discovery: renders a "From the Blog" strip on an entity page,
 * listing recently-published blog posts that tag this entity. Nothing
 * renders when there are no matching posts.
 */
export function EntityBlogPosts({
  kind,
  entityId,
  heading = "From the Blog",
  limit = 3,
  className,
}: {
  kind: BlogEntityKind;
  entityId: string;
  heading?: string;
  limit?: number;
  className?: string;
}) {
  const listFn = useServerFn(listBlogPostsForEntity);
  const q = useQuery({
    queryKey: ["entity-blog-posts", kind, entityId, limit],
    queryFn: () => listFn({ data: { kind, entityId, limit } }),
    staleTime: 60_000,
  });
  const posts = q.data ?? [];
  if (posts.length === 0) return null;

  return (
    <section className={className ?? "mt-8"}>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-display text-lg text-ink">{heading}</h3>
        <Link to="/blog" className="text-xs text-ink-muted hover:text-ink">All posts →</Link>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {posts.map((p) => (
          <Link
            key={p.id}
            to="/blog/$slug"
            params={{ slug: p.slug }}
            className="group block overflow-hidden rounded-2xl border border-border bg-surface hover:bg-muted"
          >
            {p.cover_image_url ? (
              <img
                src={p.cover_image_url}
                alt={p.cover_image_alt ?? p.title}
                className="aspect-[16/10] w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="aspect-[16/10] w-full gradient-motion" />
            )}
            <div className="p-3">
              <div className="text-[11px] uppercase tracking-wider text-ink-muted">
                {p.published_at &&
                  new Date(p.published_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
              </div>
              <div className="mt-1 font-display text-sm leading-snug text-ink group-hover:underline">
                {p.title}
              </div>
              {p.excerpt && <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{p.excerpt}</p>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

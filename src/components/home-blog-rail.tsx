import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, BookOpen } from "lucide-react";
import { listPublishedPosts } from "@/lib/blog.functions";
import { cn } from "@/lib/utils";

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function HomeBlogRail() {
  const fetchPosts = useServerFn(listPublishedPosts);
  const { data, isLoading } = useQuery({
    queryKey: ["home-blog-rail"],
    queryFn: () => fetchPosts(),
    staleTime: 60_000,
  });

  const posts = (data ?? []).slice(0, 6);

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-ink-muted">
            <BookOpen className="h-3.5 w-3.5" /> From the blog
          </div>
          <h2 className="font-display text-2xl text-ink md:text-3xl">Recent reads</h2>
        </div>
        <Link
          to="/blog"
          className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-ink-soft hover:bg-muted transition"
        >
          All posts <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {isLoading && posts.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="aspect-[16/10] w-full animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/60 p-8 text-center text-sm text-ink-muted">
          No posts yet — check back soon.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <Link
              key={p.id}
              to="/blog/$slug"
              params={{ slug: p.slug }}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface hover:shadow-soft transition"
            >
              <div
                className={cn(
                  "aspect-[16/10] w-full overflow-hidden bg-muted",
                  !p.cover_image_url && "gradient-soft",
                )}
                style={
                  p.cover_image_url
                    ? { backgroundImage: `url(${p.cover_image_url})`, backgroundSize: "cover", backgroundPosition: "center" }
                    : undefined
                }
              />
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="text-[11px] uppercase tracking-wider text-ink-muted">
                  {formatDate(p.published_at)}
                  {p.author_name ? <> · by {p.author_name}</> : null}
                </div>
                <h3 className="font-display text-lg leading-snug text-ink group-hover:text-primary line-clamp-2">
                  {p.title}
                </h3>
                {p.excerpt ? (
                  <p className="text-sm text-ink-soft line-clamp-2">{p.excerpt}</p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

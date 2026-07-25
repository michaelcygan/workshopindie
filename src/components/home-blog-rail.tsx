import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen } from "lucide-react";
import { listPublishedPosts } from "@/lib/blog.functions";
import { EditorialCard } from "@/components/editorial-card";
import { HomeSectionHeader } from "@/components/home-section";

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
      <HomeSectionHeader
        eyebrow={<><BookOpen className="h-3.5 w-3.5" /> From the blog</>}
        title="Recent reads"
        kicker="Long-form on craft, careers, and the artists shaping the culture."
        href="/blog"
        cta="All posts"
      />

      <div className="mt-8">
        {isLoading && posts.length === 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="aspect-[16/10] w-full animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface/60 p-8 text-center text-sm text-ink-muted">
            No posts yet — check back soon.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <EditorialCard
                key={p.id}
                cover={p.cover_image_url ?? null}
                eyebrow={
                  <>
                    {formatDate(p.published_at)}
                    {p.author_name ? <> · by {p.author_name}</> : null}
                  </>
                }
                title={p.title}
                dek={p.excerpt ?? undefined}
                href="/blog/$slug"
                hrefParams={{ slug: p.slug }}
                ariaLabel={p.title}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

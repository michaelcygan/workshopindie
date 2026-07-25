import { ExternalLink, Link2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BlogPostBody } from "@/components/blog-post-body";
import { getPublishedPost } from "@/lib/blog.functions";

const SITE = "https://workshopindie.com";

export function BlogPostPeek({
  slug,
  open,
  onOpenChange,
}: {
  slug: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const fetchPost = useServerFn(getPublishedPost);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["blog-peek", slug],
    queryFn: () => fetchPost({ data: { slug: slug! } }),
    enabled: open && !!slug,
    staleTime: 60_000,
  });

  const post = data ?? null;
  const canonical = slug ? `${SITE}/blog/${slug}` : SITE;
  const published = post?.published_at ? new Date(post.published_at) : null;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(canonical);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy link");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[calc(100vw-1rem)] p-0 overflow-hidden gap-0 md:w-full max-h-[92vh] flex flex-col">
        <DialogTitle className="sr-only">{post?.title ?? "Article"}</DialogTitle>
        {isLoading || !slug ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="aspect-video w-full rounded-2xl" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        ) : isError || !post ? (
          <div className="p-8 text-center">
            <div className="font-display text-xl text-ink">This post isn't available.</div>
            <p className="mt-2 text-sm text-ink-muted">
              It may have been removed, unpublished, or scheduled for later.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <article className="p-5 md:p-8">
              <div className="text-xs uppercase tracking-wider text-ink-muted">
                {published?.toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
              <h1 className="mt-2 font-display text-2xl leading-tight text-ink md:text-3xl">
                {post.title}
              </h1>
              {post.excerpt && (
                <p className="mt-3 text-base text-ink-soft md:text-lg">{post.excerpt}</p>
              )}
              {post.authors && post.authors.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
                  <span>By</span>
                  {post.authors.map((a, i) => (
                    <span key={a.id}>
                      {a.username ? (
                        <a
                          href={`/u/${a.username}?tab=blog`}
                          className="font-medium text-ink underline decoration-border underline-offset-4 hover:decoration-primary"
                        >
                          {a.display_name || a.username}
                        </a>
                      ) : (
                        <span className="text-ink">{a.display_name}</span>
                      )}
                      {a.role_label ? <span className="text-ink-muted"> · {a.role_label}</span> : null}
                      {i < post.authors!.length - 1 ? <span className="ml-1">,</span> : null}
                    </span>
                  ))}
                </div>
              )}
              {post.cover_image_url && (
                <img
                  src={post.cover_image_url}
                  alt={post.cover_image_alt ?? post.title}
                  className="mt-6 w-full rounded-2xl border border-border object-cover"
                  loading="lazy"
                  decoding="async"
                />
              )}
              <div className="mt-6">
                <BlogPostBody markdown={post.body_markdown} />
              </div>
            </article>
            <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-background/95 p-3 backdrop-blur">
              <Button variant="ghost" size="sm" className="rounded-full gap-1.5" onClick={copyLink}>
                <Link2 className="h-4 w-4" /> Copy link
              </Button>
              <Button asChild variant="outline" size="sm" className="rounded-full gap-1.5">
                <a href={`/blog/${post.slug}`}>
                  Open full article <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

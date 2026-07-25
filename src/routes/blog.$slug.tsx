import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getPublishedPost, getRelatedPosts } from "@/lib/blog.functions";
import { BlogPostBody } from "@/components/blog-post-body";
import { ArrowLeft } from "lucide-react";

const SITE = "https://workshopindie.com";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const post = await getPublishedPost({ data: { slug: params.slug } });
    if (!post) throw notFound();
    return { post };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return { meta: [{ title: "Not found — Workshop" }, { name: "robots", content: "noindex" }] };
    }
    const p = loaderData.post;
    const title = (p.seo_title?.trim() || p.title).slice(0, 80);
    const description = (p.seo_description?.trim() || p.excerpt || "").slice(0, 200);
    const url = `${SITE}/blog/${params.slug}`;
    const img = p.cover_image_url ?? null;
    const meta: Array<Record<string, string>> = [
      { title: `${title} — Workshop` },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: url },
      { property: "og:site_name", content: "Workshop" },
      { name: "twitter:card", content: img ? "summary_large_image" : "summary" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { property: "article:published_time", content: p.published_at ?? "" },
      { property: "article:modified_time", content: p.updated_at ?? "" },
    ];
    if (img) {
      meta.push({ property: "og:image", content: img });
      meta.push({ property: "og:image:alt", content: p.cover_image_alt ?? title });
      meta.push({ name: "twitter:image", content: img });
    }
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: p.title,
            description,
            image: img ? [img] : undefined,
            datePublished: p.published_at,
            dateModified: p.updated_at,
            author: p.author_profile?.username
              ? {
                  "@type": "Person",
                  name: p.author_name || p.author_profile.display_name || p.author_profile.username,
                  url: `${SITE}/u/${p.author_profile.username}`,
                }
              : { "@type": "Organization", name: p.author_name || "Workshop" },
            publisher: {
              "@type": "Organization",
              name: "Workshop",
              logo: { "@type": "ImageObject", url: `${SITE}/favicon.png` },
            },
            mainEntityOfPage: url,
            url,
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Workshop", item: SITE },
              { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE}/blog` },
              { "@type": "ListItem", position: 3, name: p.title, item: url },
            ],
          }),
        },
      ],
    };
  },
  component: BlogPostPage,
});

function BlogPostPage() {
  const { post } = Route.useLoaderData();
  const related = useServerFn(getRelatedPosts);
  const { data: relatedPosts } = useQuery({
    queryKey: ["blog-related", post.id],
    queryFn: () => related({ data: { excludeId: post.id, limit: 3 } }),
    staleTime: 60_000,
  });

  const publishedAt = post.published_at ? new Date(post.published_at) : null;
  const updatedAt = post.updated_at ? new Date(post.updated_at) : null;
  const meaningfullyUpdated =
    publishedAt && updatedAt && updatedAt.getTime() - publishedAt.getTime() > 24 * 60 * 60 * 1000;

  return (
    <article className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-14">
      <Link to="/blog" className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to Blog
      </Link>

      <header className="mt-6">
        <div className="text-xs uppercase tracking-wider text-ink-muted">
          {publishedAt?.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
          {meaningfullyUpdated && (
            <> · Updated {updatedAt!.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</>
          )}
        </div>
        <h1 className="mt-3 font-display text-4xl leading-tight text-ink md:text-5xl">{post.title}</h1>
        {post.excerpt && (
          <p className="mt-4 text-lg text-ink-soft">{post.excerpt}</p>
        )}
        <div className="mt-4 text-sm text-ink-muted">
          By{" "}
          {post.author_profile?.username ? (
            <Link
              to="/u/$username"
              params={{ username: post.author_profile.username }}
              className="font-medium text-ink underline decoration-border underline-offset-4 hover:decoration-primary"
            >
              {post.author_name || post.author_profile.display_name || post.author_profile.username}
            </Link>
          ) : (
            post.author_name || "Workshop"
          )}
        </div>
      </header>

      {post.cover_image_url && (
        <img
          src={post.cover_image_url}
          alt={post.cover_image_alt ?? post.title}
          className="mt-8 w-full rounded-3xl border border-border object-cover"
        />
      )}

      <div className="mt-8">
        <BlogPostBody markdown={post.body_markdown} />
      </div>

      {/* Conversion */}
      <aside className="mt-14 rounded-3xl border border-border bg-surface p-6 md:p-8">
        <h3 className="font-display text-2xl text-ink">Make something with people.</h3>
        <p className="mt-2 text-ink-soft">
          Create a free portfolio, find collaborators, and join creative communities.
        </p>
        <div className="mt-4">
          <Link
            to="/signup"
            className="gradient-motion inline-flex items-center rounded-full px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Join Workshop
          </Link>
        </div>
      </aside>

      {/* Related */}
      {relatedPosts && relatedPosts.length > 0 && (
        <section className="mt-14">
          <h3 className="mb-4 font-display text-xl text-ink">More from the blog</h3>
          <div className="grid gap-4 md:grid-cols-3">
            {relatedPosts.map((r) => (
              <Link
                key={r.id}
                to="/blog/$slug"
                params={{ slug: r.slug }}
                className="group block rounded-2xl border border-border bg-surface p-4 hover:bg-muted"
              >
                {r.cover_image_url && (
                  <img
                    src={r.cover_image_url}
                    alt={r.cover_image_alt ?? r.title}
                    className="mb-3 aspect-video w-full rounded-xl object-cover"
                    loading="lazy"
                  />
                )}
                <div className="font-display text-base text-ink group-hover:underline">{r.title}</div>
                {r.excerpt && <div className="mt-1 line-clamp-2 text-sm text-ink-muted">{r.excerpt}</div>}
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

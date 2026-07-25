import { createFileRoute, Link } from "@tanstack/react-router";
import { listPublishedPosts } from "@/lib/blog.functions";

const SITE = "https://workshopindie.com";
const TITLE = "Workshop Blog — Creative Collaboration, Independent Art & Artist Portfolios";
const DESC = "Ideas, guides, and stories about finding collaborators, making independent creative work, and building a portfolio that shows how the work happened.";

export const Route = createFileRoute("/blog/")({
  loader: async () => {
    const posts = await listPublishedPosts();
    return { posts };
  },
  head: ({ loaderData }) => {
    const url = `${SITE}/blog`;
    return {
      meta: [
        { title: TITLE },
        { name: "description", content: DESC },
        { property: "og:title", content: TITLE },
        { property: "og:description", content: DESC },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:site_name", content: "Workshop" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: TITLE },
        { name: "twitter:description", content: DESC },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "Workshop Blog",
          url,
          publisher: { "@type": "Organization", name: "Workshop", url: SITE },
          blogPost: (loaderData?.posts ?? []).slice(0, 20).map((p) => ({
            "@type": "BlogPosting",
            headline: p.title,
            url: `${SITE}/blog/${p.slug}`,
            datePublished: p.published_at,
          })),
        }),
      }],
    };
  },
  component: BlogIndexPage,
});

function BlogIndexPage() {
  const { posts } = Route.useLoaderData();
  const [featured, ...rest] = posts;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-14">
      <div className="text-xs uppercase tracking-widest text-ink-muted">Blog</div>
      <h1 className="mt-2 font-display text-4xl leading-tight text-ink md:text-5xl">
        Notes from Workshop
      </h1>
      <p className="mt-4 max-w-2xl text-ink-soft md:text-lg">
        Ideas, guides, and stories about finding collaborators, making independent creative work,
        and building a portfolio that shows how the work happened.
      </p>

      {posts.length === 0 ? (
        <div className="mt-14 rounded-3xl border border-dashed border-border bg-surface-2/40 p-10 text-center">
          <div className="font-display text-xl text-ink">Nothing published yet.</div>
          <p className="mt-2 text-ink-muted">The first notes are being written. Come back soon.</p>
        </div>
      ) : (
        <>
          {/* Featured */}
          <Link
            to="/blog/$slug"
            params={{ slug: featured.slug }}
            className="mt-10 block overflow-hidden rounded-3xl border border-border bg-surface hover:bg-muted"
          >
            <div className="grid gap-0 md:grid-cols-2">
              {featured.cover_image_url ? (
                <img
                  src={featured.cover_image_url}
                  alt={featured.cover_image_alt ?? featured.title}
                  className="aspect-[4/3] w-full object-cover md:aspect-auto md:h-full"
                />
              ) : (
                <div className="aspect-[4/3] w-full gradient-motion md:aspect-auto md:h-full" />
              )}
              <div className="p-6 md:p-10">
                <div className="text-xs uppercase tracking-wider text-ink-muted">
                  {featured.published_at &&
                    new Date(featured.published_at).toLocaleDateString(undefined, {
                      year: "numeric", month: "long", day: "numeric",
                    })}
                </div>
                <h2 className="mt-2 font-display text-3xl leading-tight text-ink">{featured.title}</h2>
                {featured.excerpt && (
                  <p className="mt-3 text-ink-soft">{featured.excerpt}</p>
                )}
                <div className="mt-4 text-sm text-primary underline underline-offset-2">Read →</div>
              </div>
            </div>
          </Link>

          {rest.length > 0 && (
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {rest.map((p) => (
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
                  <div className="p-5">
                    <div className="text-xs uppercase tracking-wider text-ink-muted">
                      {p.published_at &&
                        new Date(p.published_at).toLocaleDateString(undefined, {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                    </div>
                    <div className="mt-1 font-display text-xl leading-snug text-ink group-hover:underline">
                      {p.title}
                    </div>
                    {p.excerpt && <p className="mt-2 line-clamp-3 text-sm text-ink-muted">{p.excerpt}</p>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

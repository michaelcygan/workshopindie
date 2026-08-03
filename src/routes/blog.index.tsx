import { createFileRoute, Link } from "@tanstack/react-router";
import { listPublishedPosts } from "@/lib/blog.functions";

const SITE = "https://workshopindie.com";
const TITLE = "Workshop Blog — Creative Collaboration, Independent Art & Artist Portfolios";
const DESC = "Ideas, guides, and stories about finding collaborators, making independent creative work, and building a portfolio that shows how the work happened.";

type AuthorProfile = {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
} | null;

type BlogListItem = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  author_name: string;
  published_at: string | null;
  updated_at: string;
  featured?: boolean | null;
  publication_type?: string | null;
  author_profile?: AuthorProfile;
};

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
          blogPost: (loaderData?.posts ?? []).slice(0, 20).map((p: { title: string; slug: string; published_at: string | null }) => ({
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

function formatDate(value: string | null, long = false) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, long
    ? { year: "numeric", month: "long", day: "numeric" }
    : { month: "short", day: "numeric", year: "numeric" });
}

function authorOf(p: BlogListItem) {
  const profile = p.author_profile ?? null;
  return {
    name: profile?.display_name || p.author_name,
    username: profile?.username ?? null,
    avatar: profile?.avatar_url ?? null,
  };
}

function Byline({ post, className = "" }: { post: BlogListItem; className?: string }) {
  const author = authorOf(post);
  return (
    <div className={`flex min-w-0 items-center gap-2 text-xs text-ink-muted ${className}`}>
      {author.avatar ? (
        <img
          src={author.avatar}
          alt=""
          className="h-5 w-5 shrink-0 rounded-full object-cover"
          loading="lazy"
        />
      ) : (
        <span className="h-5 w-5 shrink-0 rounded-full bg-muted" aria-hidden />
      )}
      <span className="truncate">{author.name}</span>
      {post.published_at && (
        <>
          <span aria-hidden className="text-ink-muted/60">·</span>
          <span className="shrink-0">{formatDate(post.published_at)}</span>
        </>
      )}
    </div>
  );
}

function FeaturedHero({ post }: { post: BlogListItem }) {
  return (
    <Link
      to="/blog/$slug"
      params={{ slug: post.slug }}
      className="group mt-6 block overflow-hidden rounded-3xl border border-border bg-surface hover:bg-muted md:mt-10"
    >
      <div className="grid gap-0 md:grid-cols-2">
        <div className="relative">
          {post.cover_image_url ? (
            <img
              src={post.cover_image_url}
              alt={post.cover_image_alt ?? post.title}
              className="aspect-[16/10] w-full object-cover md:aspect-auto md:h-full"
            />
          ) : (
            <div className="aspect-[16/10] w-full gradient-motion md:aspect-auto md:h-full" />
          )}
          <span className="absolute left-3 top-3 rounded-full bg-surface/90 px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-ink backdrop-blur">
            Featured
          </span>
        </div>
        <div className="p-5 md:p-10">
          <h2 className="font-display text-2xl leading-tight text-ink group-hover:underline md:text-3xl">
            {post.title}
          </h2>
          {post.excerpt && (
            <p className="mt-2 line-clamp-2 text-sm text-ink-soft md:mt-3 md:line-clamp-none md:text-base">
              {post.excerpt}
            </p>
          )}
          <Byline post={post} className="mt-3" />
        </div>
      </div>
    </Link>
  );
}

/** Mobile: dense horizontal row. Desktop: the row is hidden in favor of PostCard. */
function PostRow({ post }: { post: BlogListItem }) {
  return (
    <Link
      to="/blog/$slug"
      params={{ slug: post.slug }}
      className="flex min-h-[88px] items-center gap-3 rounded-2xl border border-border bg-surface p-3 active:bg-muted"
    >
      {post.cover_image_url ? (
        <img
          src={post.cover_image_url}
          alt={post.cover_image_alt ?? post.title}
          className="h-20 w-20 shrink-0 rounded-xl object-cover"
          loading="lazy"
        />
      ) : (
        <div className="h-20 w-20 shrink-0 rounded-xl gradient-motion" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <div className="font-display text-[17px] leading-snug text-ink line-clamp-2">{post.title}</div>
        {post.excerpt && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-ink-muted">{post.excerpt}</p>
        )}
        <Byline post={post} className="mt-1.5" />
      </div>
    </Link>
  );
}

function PostCard({ post }: { post: BlogListItem }) {
  return (
    <Link
      to="/blog/$slug"
      params={{ slug: post.slug }}
      className="group block overflow-hidden rounded-2xl border border-border bg-surface hover:bg-muted"
    >
      {post.cover_image_url ? (
        <img
          src={post.cover_image_url}
          alt={post.cover_image_alt ?? post.title}
          className="aspect-[16/10] w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="aspect-[16/10] w-full gradient-motion" aria-hidden />
      )}
      <div className="p-5">
        <div className="font-display text-xl leading-snug text-ink group-hover:underline">
          {post.title}
        </div>
        {post.excerpt && <p className="mt-2 line-clamp-3 text-sm text-ink-muted">{post.excerpt}</p>}
        <Byline post={post} className="mt-3" />
      </div>
    </Link>
  );
}

function BlogIndexPage() {
  const { posts } = Route.useLoaderData() as { posts: BlogListItem[] };
  const featured = posts.find((p) => p.featured) ?? null;
  const rest = featured ? posts.filter((p) => p.id !== featured.id) : posts;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-6 md:px-6 md:py-14 md:pb-16">
      <div className="text-[10px] uppercase tracking-widest text-ink-muted md:text-xs">Blog</div>
      <h1 className="mt-1 font-display text-3xl leading-tight text-ink md:mt-2 md:text-5xl">
        Notes from Workshop
      </h1>
      <p className="mt-2 line-clamp-2 max-w-2xl text-sm text-ink-soft sm:line-clamp-none md:mt-4 md:text-lg">
        Ideas, guides, and stories about finding collaborators, making independent creative work,
        and building a portfolio that shows how the work happened.
      </p>

      {posts.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-border bg-surface-2/40 p-8 text-center md:mt-14 md:p-10">
          <div className="font-display text-xl text-ink">Nothing published yet.</div>
          <p className="mt-2 text-ink-muted">The first notes are being written. Come back soon.</p>
        </div>
      ) : (
        <>
          {featured && <FeaturedHero post={featured} />}

          {rest.length > 0 && (
            <>
              {/* Mobile: dense rows */}
              <div className="mt-5 space-y-3 md:hidden">
                {rest.map((p) => (
                  <PostRow key={p.id} post={p} />
                ))}
              </div>

              {/* Desktop: card grid */}
              <div className="mt-10 hidden gap-6 md:grid md:grid-cols-2 lg:grid-cols-3">
                {rest.map((p) => (
                  <PostCard key={p.id} post={p} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

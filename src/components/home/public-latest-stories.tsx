import { Link } from "@tanstack/react-router";
import type { PublicBlogCard } from "@/lib/home-types";

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function Byline({ post }: { post: PublicBlogCard }) {
  return (
    <p className="mt-2 text-[11px] uppercase tracking-[0.1em] text-ink-muted">
      {post.authorName ? <>{post.authorName} · </> : null}
      {formatDate(post.publishedAt)}
    </p>
  );
}

function Cover({ post, className }: { post: PublicBlogCard; className?: string }) {
  return (
    <div className={className}>
      {post.coverUrl ? (
        <img
          src={post.coverUrl}
          alt={post.coverAlt ?? post.title}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="h-full w-full bg-surface-2" />
      )}
    </div>
  );
}

/**
 * Six recent stories in an intentionally asymmetric editorial grid.
 * DOM order matches reading order; mobile collapses to a vertical list.
 */
export function PublicLatestStories({ posts }: { posts: PublicBlogCard[] }) {
  if (posts.length === 0) return null;
  const [lead, ...rest] = posts;

  return (
    <section
      aria-labelledby="latest-stories"
      className="mx-auto max-w-7xl border-b border-border px-4 py-10 md:px-6 md:py-14"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            The Blog
          </p>
          <h2 id="latest-stories" className="mt-1 font-display text-[26px] text-ink md:text-[34px]">
            Latest stories
          </h2>
        </div>
        <Link
          to="/blog"
          className="text-sm text-ink-soft underline-offset-4 transition hover:text-ink hover:underline"
        >
          Read the Blog
        </Link>
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:gap-10">
        {lead ? (
          <article className="group">
            <Link to="/blog/$slug" params={{ slug: lead.slug }} className="block">
              <Cover
                post={lead}
                className="aspect-[16/10] w-full overflow-hidden rounded-lg bg-muted"
              />
              <h3 className="mt-4 font-display text-[24px] leading-tight text-ink transition-colors group-hover:text-primary md:text-[30px]">
                {lead.title}
              </h3>
              {lead.excerpt ? (
                <p className="mt-2 max-w-prose text-[15px] text-ink-soft line-clamp-3">
                  {lead.excerpt}
                </p>
              ) : null}
              <Byline post={lead} />
            </Link>
          </article>
        ) : null}

        <div className="divide-y divide-border/70 border-border/70 md:border-l md:pl-8">
          {rest.map((p) => (
            <article key={p.id} className="group py-5 first:pt-0">
              <Link
                to="/blog/$slug"
                params={{ slug: p.slug }}
                className="grid grid-cols-[minmax(0,1fr)_88px] items-start gap-4"
              >
                <div className="min-w-0">
                  <h3 className="font-display text-[17px] leading-snug text-ink transition-colors group-hover:text-primary">
                    {p.title}
                  </h3>
                  <Byline post={p} />
                </div>
                <Cover
                  post={p}
                  className="aspect-square w-[88px] shrink-0 overflow-hidden rounded-md bg-muted"
                />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/** A denser second Blog block so the page stays editorially dominant. */
export function PublicMoreStories({ posts }: { posts: PublicBlogCard[] }) {
  if (posts.length === 0) return null;
  return (
    <section
      aria-labelledby="more-stories"
      className="mx-auto max-w-7xl border-b border-border px-4 py-10 md:px-6 md:py-14"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            More from the Blog
          </p>
          <h2 id="more-stories" className="mt-1 font-display text-[24px] text-ink md:text-[30px]">
            Keep reading
          </h2>
        </div>
        <Link
          to="/blog"
          className="text-sm text-ink-soft underline-offset-4 transition hover:text-ink hover:underline"
        >
          All stories
        </Link>
      </div>

      <div className="mt-6 grid gap-x-10 md:grid-cols-2">
        {posts.map((p) => (
          <article key={p.id} className="group border-t border-border/70 py-4">
            <Link
              to="/blog/$slug"
              params={{ slug: p.slug }}
              className="grid grid-cols-[minmax(0,1fr)_64px] items-start gap-4"
            >
              <div className="min-w-0">
                <h3 className="font-display text-[16px] leading-snug text-ink transition-colors group-hover:text-primary">
                  {p.title}
                </h3>
                <Byline post={p} />
              </div>
              <Cover
                post={p}
                className="aspect-square w-16 shrink-0 overflow-hidden rounded bg-muted"
              />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

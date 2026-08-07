import { Link } from "@tanstack/react-router";
import type { PublicBlogCard } from "@/lib/home-types";
import { formatLongDate as formatDate } from "@/lib/format-date";

/**
 * The lead editorial block: one large feature plus two compact secondary
 * stories, all visible and clickable at once.
 */
export function PublicFeaturedStories({ posts }: { posts: PublicBlogCard[] }) {
  if (posts.length === 0) return null;
  const [lead, ...secondary] = posts;
  if (!lead) return null;
  const rest = secondary.slice(0, 2);

  return (
    <section aria-label="Featured stories" className="border-b border-border">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          Featured story
        </p>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-start md:gap-10">
          <Link
            to="/blog/$slug"
            params={{ slug: lead.slug }}
            className="group block"
            aria-label={lead.title}
          >
            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-muted">
              {lead.coverUrl ? (
                <img
                  src={lead.coverUrl}
                  alt={lead.coverAlt ?? lead.title}
                  loading="eager"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center border border-border bg-surface p-6">
                  <span className="font-display text-2xl italic text-ink-soft">Workshop</span>
                </div>
              )}
            </div>
          </Link>

          <div className="min-w-0">
            <Link to="/blog/$slug" params={{ slug: lead.slug }} className="group block">
              <h2 className="font-display text-[26px] leading-[1.12] text-ink transition-colors group-hover:text-primary md:text-[38px]">
                {lead.title}
              </h2>
              {lead.excerpt ? (
                <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-ink-soft line-clamp-3">
                  {lead.excerpt}
                </p>
              ) : null}
              <p className="mt-3 text-[12px] uppercase tracking-[0.1em] text-ink-muted">
                {lead.authorName ? <>{lead.authorName} · </> : null}
                {formatDate(lead.publishedAt)}
              </p>
            </Link>

            {rest.length > 0 ? (
              <div className="mt-5 border-t border-border">
                {rest.map((post) => (
                  <Link
                    key={post.id}
                    to="/blog/$slug"
                    params={{ slug: post.slug }}
                    className="group grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3 border-b border-border py-3 transition hover:bg-muted/40"
                  >
                    <div className="aspect-square w-[72px] overflow-hidden rounded-md bg-muted">
                      {post.coverUrl ? (
                        <img
                          src={post.coverUrl}
                          alt={post.coverAlt ?? post.title}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center border border-border bg-surface">
                          <span className="font-display text-sm italic text-ink-soft">W/</span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display text-[16px] leading-snug text-ink transition-colors group-hover:text-primary line-clamp-2 md:text-[18px]">
                        {post.title}
                      </h3>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.1em] text-ink-muted">
                        {formatDate(post.publishedAt)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

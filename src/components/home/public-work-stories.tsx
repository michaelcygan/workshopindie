import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { HomeWorkStory } from "@/lib/home-types";
import { HOME_STORY_LABEL_TEXT } from "@/lib/home-types";

/**
 * Public presentation of the trusted Work ↔ Blog composites.
 * Static two-column editorial layout — no carousel, no extra fetching.
 */
export function PublicWorkStories({ stories }: { stories: HomeWorkStory[] }) {
  if (stories.length === 0) return null;

  return (
    <section
      aria-labelledby="behind-the-work"
      className="mx-auto max-w-7xl border-b border-border px-4 py-10 md:px-6 md:py-14"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
        Behind the Work
      </p>
      <h2 id="behind-the-work" className="mt-1 font-display text-[26px] text-ink md:text-[32px]">
        The story doesn&apos;t end at publish.
      </h2>
      <p className="mt-2 max-w-md text-sm text-ink-soft">
        Process notes, context, and essays connected to the work itself.
      </p>

      <div className="mt-8 space-y-10">
        {stories.map(({ work, credits, stories: posts }) => {
          const focal =
            work.cover_focal_x != null && work.cover_focal_y != null
              ? `${work.cover_focal_x * 100}% ${work.cover_focal_y * 100}%`
              : undefined;
          const names = credits
            .map((c) => c.display_name || c.username)
            .filter(Boolean)
            .slice(0, 3)
            .join(", ");
          return (
            <article
              key={work.id}
              className="grid gap-6 border-t border-border/70 pt-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-10"
            >
              <Link to="/works/$slug" params={{ slug: work.slug }} className="group block">
                <div className="aspect-[16/10] w-full overflow-hidden rounded-lg bg-muted">
                  {work.cover_url ? (
                    <img
                      src={work.cover_url}
                      alt={work.title}
                      loading="lazy"
                      decoding="async"
                      style={focal ? { objectPosition: focal } : undefined}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="h-full w-full bg-surface-2" />
                  )}
                </div>
                <h3 className="mt-3 font-display text-[22px] leading-tight text-ink transition-colors group-hover:text-primary">
                  {work.title}
                </h3>
                {names ? <p className="mt-1 text-sm text-ink-soft">{names}</p> : null}
              </Link>

              <ul className="space-y-4 md:self-center">
                {posts.slice(0, 3).map((p) => (
                  <li key={p.id} className="border-l border-border pl-4">
                    <p className="text-[11px] uppercase tracking-[0.1em] text-ink-muted">
                      {HOME_STORY_LABEL_TEXT[p.label]}
                    </p>
                    <Link
                      to="/blog/$slug"
                      params={{ slug: p.slug }}
                      className="mt-1 block font-display text-[18px] leading-snug text-ink transition-colors hover:text-primary"
                    >
                      {p.title}
                    </Link>
                    {p.excerpt ? (
                      <p className="mt-1 text-sm text-ink-soft line-clamp-2">{p.excerpt}</p>
                    ) : null}
                  </li>
                ))}
                <li>
                  <Link
                    to="/works/$slug"
                    params={{ slug: work.slug }}
                    className="inline-flex items-center gap-1.5 text-sm text-ink-soft underline-offset-4 transition hover:text-ink hover:underline"
                  >
                    See the Work <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </li>
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}

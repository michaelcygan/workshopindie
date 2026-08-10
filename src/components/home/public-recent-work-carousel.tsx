import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { PublicWorkTile } from "@/lib/home-types";
import { CATEGORY_LABELS, type Category } from "@/lib/categories";

/**
 * A compact, horizontally scrollable carousel of recent published Work.
 *
 * Sits between the Latest Stories and Open Calls sections to give Work a
 * slightly more prominent presence on the logged-out homepage. Cards are
 * small enough to scan quickly without pushing the editorial content below the
 * fold. A future mobile filter menu can be added here once categories are
 * defined.
 */
export function PublicRecentWorkCarousel({ works }: { works: PublicWorkTile[] }) {
  if (works.length === 0) return null;

  return (
    <section
      aria-labelledby="recent-work"
      className="mx-auto max-w-7xl border-b border-border px-4 py-8 md:px-6 md:py-10"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Made on Workshop
          </p>
          <h2 id="recent-work" className="mt-1 font-display text-[22px] text-ink md:text-[28px]">
            Recent Work
          </h2>
        </div>
        <Link
          to="/gallery"
          className="hidden items-center gap-1.5 text-sm text-ink-soft underline-offset-4 transition hover:text-ink hover:underline sm:inline-flex"
        >
          Browse the Gallery <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="relative mt-5">
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2">
          {works.map((w) => (
            <Link
              key={w.id}
              to="/works/$slug"
              params={{ slug: w.slug }}
              search={{ story: undefined }}
              className="group shrink-0 snap-start"
            >
              <div className="w-[210px] md:w-[240px]">
                <div className="aspect-[16/10] w-full overflow-hidden rounded-lg bg-muted">
                  <img
                    src={w.coverUrl}
                    alt={w.title}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  />
                </div>
                <p className="mt-2.5 text-[11px] uppercase tracking-[0.1em] text-ink-muted">
                  {categoryLabel(w.category)}
                  {w.creditName ? ` · ${w.creditName}` : ""}
                </p>
                <h3 className="mt-1 font-display text-[16px] leading-snug text-ink transition-colors group-hover:text-primary">
                  {w.title}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

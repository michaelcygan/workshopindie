import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { PublicWorkTile } from "@/lib/home-types";
import type { Category } from "@/lib/categories";
import { categoryLabel } from "@/lib/taxonomy";

/** A concise visual coda — Work imagery, no Gallery controls. */
export function PublicWorkStrip({ works }: { works: PublicWorkTile[] }) {
  if (works.length === 0) return null;

  return (
    <section
      aria-labelledby="more-work"
      className="mx-auto max-w-7xl border-b border-border px-4 py-10 md:px-6 md:py-14"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Made on Workshop
          </p>
          <h2 id="more-work" className="mt-1 font-display text-[24px] text-ink md:text-[30px]">
            More Work
          </h2>
        </div>
        <Link
          to="/gallery"
          className="inline-flex items-center gap-1.5 text-sm text-ink-soft underline-offset-4 transition hover:text-ink hover:underline"
        >
          Browse the Gallery <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {works.map((w) => (
          <Link
            key={w.id}
            to="/works/$slug"
            params={{ slug: w.slug }}
            search={{ story: undefined }}
            className="group block"
          >
            <div className="aspect-[16/10] w-full overflow-hidden rounded-lg bg-muted">
              <img
                src={w.coverUrl}
                alt={w.title}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              />
            </div>
            <p className="mt-3 text-[11px] uppercase tracking-[0.1em] text-ink-muted">
              {categoryLabel(w.category)}
              {w.creditName ? ` · ${w.creditName}` : ""}
            </p>
            <h3 className="mt-1 font-display text-[18px] leading-snug text-ink transition-colors group-hover:text-primary">
              {w.title}
            </h3>
          </Link>
        ))}
      </div>
    </section>
  );
}

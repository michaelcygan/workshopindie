import { ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { influenceDisplay, type Influence } from "@/lib/influences/types";
import { CATEGORIES, type Category } from "@/lib/categories";
import { CategoryChip } from "@/components/category-chip";
import { cn } from "@/lib/utils";

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** One influence: a Workshop Work, or an external reference. Quiet by design. */
export function InfluenceCard({ influence }: { influence: Influence }) {
  const d = influenceDisplay(influence);
  const cat = CATEGORIES.includes(d.category as Category) ? (d.category as Category) : null;
  const host = hostOf(influence.external_url);
  const isWork = influence.source_kind === "workshop_work" && !!influence.work;

  const inner = (
    <>
      <div className="aspect-[16/10] w-full overflow-hidden rounded-lg bg-surface-2">
        {d.thumbnail ? (
          <img
            src={d.thumbnail}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-widest text-ink-muted">
            {cat ?? host ?? "Reference"}
          </div>
        )}
      </div>
      <div className="mt-2 space-y-1">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-ink">{d.title}</p>
        {d.creator && <p className="line-clamp-1 text-xs text-ink-muted">{d.creator}</p>}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {cat && <CategoryChip category={cat} />}
          {!isWork && host && (
            <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted">
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              {host}
            </span>
          )}
        </div>
      </div>
    </>
  );

  const className = cn("group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring");

  if (isWork) {
    return (
      <Link to="/w/$slug" params={{ slug: influence.work!.slug }} className={className}>
        {inner}
      </Link>
    );
  }
  if (influence.external_url) {
    return (
      <a href={influence.external_url} target="_blank" rel="noopener noreferrer nofollow" className={className}>
        {inner}
      </a>
    );
  }
  // Work removed or hidden — keep the snapshot, drop the link.
  return <div className={className}>{inner}</div>;
}

export function InfluencesGrid({ influences }: { influences: Influence[] }) {
  if (influences.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {influences.map((i) => (
        <InfluenceCard key={i.id} influence={i} />
      ))}
    </div>
  );
}

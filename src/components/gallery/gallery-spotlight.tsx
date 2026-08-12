import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CategoryChip } from "@/components/category-chip";
import type { Category } from "@/lib/categories";

type SpotlightWork = {
  id: string;
  title: string;
  slug: string;
  category: Category;
  cover_url: string | null;
  excerpt?: string | null;
  work_credits?: { sort_order: number; display_name: string | null; profiles: { display_name: string | null; username: string | null } | null }[];
};

function creditLine(w: SpotlightWork) {
  const names = (w.work_credits ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => c.profiles?.display_name || c.display_name || c.profiles?.username)
    .filter(Boolean) as string[];
  if (names.length === 0) return null;
  return names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(" & ");
}

async function fetchSpotlight(): Promise<SpotlightWork[]> {
  const since = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("works")
    .select(
      "id,title,slug,category,cover_url,excerpt,popularity_score,published_at, work_credits(sort_order, display_name, profiles(display_name,username))",
    )
    .eq("status", "published")
    .eq("visibility", "public")
    .not("cover_url", "is", null)
    .gte("published_at", since)
    .order("popularity_score", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(3);
  if (error) return [];
  return (data ?? []) as SpotlightWork[];
}

/**
 * Editorial lead-in above the Gallery grid: one hero piece plus two runners-up
 * on desktop, a single swipeable rail on mobile. Only rendered on the default,
 * unfiltered view so it never fights an active query.
 */
export function GallerySpotlight() {
  const { data, isLoading } = useQuery({
    queryKey: ["gallery-spotlight"],
    queryFn: fetchSpotlight,
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <section className="mx-auto max-w-7xl px-4 pt-5 md:px-6">
        <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
          <div className="aspect-[16/10] animate-pulse rounded-2xl bg-surface-2" />
          <div className="hidden grid-rows-2 gap-3 lg:grid">
            <div className="animate-pulse rounded-2xl bg-surface-2" />
            <div className="animate-pulse rounded-2xl bg-surface-2" />
          </div>
        </div>
      </section>
    );
  }

  const works = data ?? [];
  if (works.length === 0) return null;
  const [hero, ...rest] = works;

  return (
    <section className="mx-auto max-w-7xl px-4 pt-5 md:px-6">
      <div className="mb-2 flex items-center gap-2">
        <Flame className="h-3.5 w-3.5 text-primary" />
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink">
          Spotlight
        </h2>
        <span className="text-xs text-ink-muted">· moving right now</span>
      </div>

      {/* Mobile: swipeable rail */}
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
        {works.map((w) => (
          <div key={w.id} className="w-[86vw] shrink-0 snap-start sm:w-[420px]">
            <SpotlightTile work={w} size="hero" />
          </div>
        ))}
      </div>

      {/* Desktop: hero + stacked runners-up */}
      <div className="hidden gap-3 lg:grid lg:h-[380px] lg:grid-cols-[1.7fr_1fr]">
        <SpotlightTile work={hero} size="hero" />
        <div className="grid grid-rows-2 gap-3">
          {rest.map((w) => (
            <SpotlightTile key={w.id} work={w} size="small" />
          ))}
        </div>
      </div>
    </section>
  );
}

function SpotlightTile({ work, size }: { work: SpotlightWork; size: "hero" | "small" }) {
  const credits = creditLine(work);
  return (
    <Link
      to="/works/$slug"
      params={{ slug: work.slug }}
      className="group relative block h-full overflow-hidden rounded-2xl border border-border bg-surface shadow-soft transition hover:border-ink/20 hover:shadow-lift"
    >
      <div className={size === "hero" ? "aspect-[16/10] lg:aspect-auto lg:h-full" : "h-full min-h-[7rem]"}>
        {work.cover_url ? (
          <img
            src={work.cover_url}
            alt={work.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="h-full w-full gradient-soft" />
        )}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />
      <div className="absolute left-3 top-3">
        <CategoryChip category={work.category} />
      </div>
      <div className="absolute inset-x-0 bottom-0 p-3 md:p-4">
        <h3
          className={
            size === "hero"
              ? "font-display text-xl leading-tight text-background md:text-2xl"
              : "font-display text-base leading-tight text-background"
          }
        >
          {work.title}
        </h3>
        {credits && (
          <p className="mt-0.5 truncate text-[11px] uppercase tracking-wide text-background/70">
            {credits}
          </p>
        )}
      </div>
    </Link>
  );
}

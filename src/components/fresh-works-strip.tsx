import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CategoryChip } from "./category-chip";
import type { Category } from "@/lib/categories";

type FreshWork = {
  id: string;
  title: string;
  slug: string;
  category: Category;
  cover_url: string | null;
  published_at: string | null;
};

async function fetchFreshWorks(): Promise<FreshWork[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("works")
    .select("id,title,slug,category,categories,cover_url,published_at")
    .eq("status", "published")
    .in("visibility", ["public", "unlisted"])
    .gte("published_at", since)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(12);
  if (error) return [];
  return (data ?? []) as FreshWork[];
}

export function FreshWorksStrip() {
  const { data } = useQuery({
    queryKey: ["fresh-works"],
    queryFn: fetchFreshWorks,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const works = data ?? [];
  if (works.length === 0) return null;
  return (
    <section className="border-b border-border bg-surface/40">
      <div className="mx-auto max-w-7xl px-4 py-4 md:px-6">
        <div className="mb-2 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink">
            Shipping right now
          </h2>
          <span className="text-xs text-ink-muted">· last 24h</span>
          <Sparkles className="ml-auto h-3.5 w-3.5 text-ink-muted" />
        </div>
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {works.map((w) => (
            <Link
              key={w.id}
              to="/works/$slug"
              params={{ slug: w.slug }}
              className="group relative shrink-0 overflow-hidden rounded-xl border border-border bg-surface shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
              style={{ width: 180 }}
            >
              <div className="aspect-[4/5] bg-surface-2">
                {w.cover_url ? (
                  <img
                    src={w.cover_url}
                    alt={w.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="h-full w-full gradient-soft" />
                )}
              </div>
              <div className="absolute left-2 top-2">
                <CategoryChip category={w.category} />
              </div>
              <div className="p-2.5">
                <h3 className="line-clamp-2 text-xs font-medium text-ink">{w.title}</h3>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

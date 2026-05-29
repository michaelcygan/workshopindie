import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, Plus } from "lucide-react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { WorkCard, type WorkCardData } from "@/components/work-card";
import { WORK_CATEGORIES, type Category } from "@/lib/categories";
import { CategoryScroller } from "@/components/category-scroller";
import { GalleryCityFilter, type CityOption } from "@/components/gallery-city-filter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listFollowingWorks } from "@/lib/gallery.functions";
import { useDefaultCity, useApplyDefaultCity } from "@/hooks/use-default-city";
import { useBlockedIds } from "@/hooks/use-blocked-ids";
import { GeoDefaultBanner } from "@/components/geo-default-banner";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  tab: fallback(z.enum(["for-you", "following"]), "for-you").default("for-you"),
  cat: fallback(z.string(), "all").default("all"),
  city: fallback(z.string(), "all").default("all"),
  sort: fallback(z.enum(["recent", "trending"]), "recent").default("recent"),
});

export const Route = createFileRoute("/gallery")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Gallery — Workshop" },
      { name: "description", content: "Browse everything people have shipped on Workshop. Filter by medium, location, and what your network is making." },
      { property: "og:title", content: "Gallery — Workshop" },
      { property: "og:description", content: "Browse everything people have shipped on Workshop." },
    ],
  }),
  component: GalleryPage,
});

const PAGE_SIZE = 30;

function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

type CityChip = CityOption;

async function fetchGalleryCities(): Promise<CityChip[]> {
  // Pull a sample of recent published works with their city; aggregate client-side.
  const { data, error } = await supabase
    .from("works")
    .select("city_id, cities(id, name, slug, country)")
    .eq("status", "published")
    .in("visibility", ["public", "unlisted"])
    .not("city_id", "is", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(1000);
  if (error) return [];
  const map = new Map<string, CityChip>();
  for (const row of (data ?? []) as Array<{
    city_id: string | null;
    cities: { id: string; name: string; slug: string; country: string } | null;
  }>) {
    const c = row.cities;
    if (!c) continue;
    const ex = map.get(c.id);
    if (ex) ex.count += 1;
    else map.set(c.id, { id: c.id, name: c.name, slug: c.slug, country: c.country, count: 1 });
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

async function fetchForYouPage(params: {
  category: string;
  citySlug: string;
  cityIdMap: Map<string, string>;
  sort: "recent" | "trending";
  q: string;
  cursor: string | null;
}): Promise<{ works: WorkCardData[]; nextCursor: string | null }> {
  let qb = supabase
    .from("works")
    .select(
      "id,title,slug,category,cover_url,embed_url,source_type,like_count,save_count,view_count,published_at,popularity_score,created_at, work_credits(role_label, sort_order, profiles(id,display_name,username))",
    )
    .eq("status", "published")
    .in("visibility", ["public", "unlisted"])
    .limit(PAGE_SIZE);

  if (params.category !== "all") qb = qb.eq("category", params.category as Category);
  if (params.citySlug !== "all") {
    const cid = params.cityIdMap.get(params.citySlug);
    if (!cid) return { works: [], nextCursor: null };
    qb = qb.eq("city_id", cid);
  }
  if (params.q.trim()) {
    const s = params.q.trim().replace(/[%,]/g, " ");
    qb = qb.or(`title.ilike.%${s}%,excerpt.ilike.%${s}%`);
  }
  if (params.sort === "recent") {
    qb = qb
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (params.cursor) qb = qb.lt("published_at", params.cursor);
  } else {
    qb = qb
      .order("popularity_score", { ascending: false })
      .order("like_count", { ascending: false });
  }

  const { data, error } = await qb;
  if (error) throw error;
  type Row = {
    id: string; title: string; slug: string; category: Category;
    cover_url: string | null; embed_url: string | null; source_type: string;
    like_count: number; save_count: number; view_count: number;
    published_at: string | null;
    work_credits?: { sort_order: number; profiles: { id: string; display_name: string | null; username: string | null } | null }[];
  };
  const works = (data as Row[]).map<WorkCardData>((r) => ({
    id: r.id, title: r.title, slug: r.slug, category: r.category,
    cover_url: r.cover_url, embed_url: r.embed_url, source_type: r.source_type,
    like_count: r.like_count, save_count: r.save_count, view_count: r.view_count,
    credits: (r.work_credits ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => ({ id: c.profiles?.id ?? null, display_name: c.profiles?.display_name ?? null, username: c.profiles?.username ?? null })),
  }));
  const last = (data as Row[])[(data as Row[]).length - 1];
  const nextCursor =
    params.sort === "recent" && works.length === PAGE_SIZE && last?.published_at
      ? last.published_at
      : null;
  return { works, nextCursor };
}

function GalleryPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/gallery" });
  const { user } = useAuth();
  const [qInput, setQInput] = useState(search.q);
  const qDebounced = useDebounced(qInput, 250);

  useEffect(() => {
    if (qDebounced !== search.q) {
      navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, q: qDebounced }), replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDebounced]);

  const tab = search.tab;
  const category = search.cat;
  const citySlug = search.city;
  const sort = search.sort;
  const q = search.q;

  // Cities with counts (cached 5 min)
  const citiesQuery = useQuery({
    queryKey: ["gallery-cities"],
    queryFn: fetchGalleryCities,
    staleTime: 5 * 60_000,
  });
  const cities = citiesQuery.data ?? [];
  const cityIdMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of cities) m.set(c.slug, c.id);
    return m;
  }, [cities]);
  

  const queryKey = useMemo(
    () => ["gallery", tab, category, citySlug, sort, q, user?.id ?? null],
    [tab, category, citySlug, sort, q, user?.id],
  );

  const queryResult = useInfiniteQuery({
    queryKey,
    initialPageParam: null as string | null,
    enabled: (tab === "for-you" || !!user) && (citySlug === "all" || cities.length > 0),
    queryFn: async ({ pageParam }) => {
      if (tab === "following") {
        return await listFollowingWorks({
          data: {
            limit: PAGE_SIZE,
            cursor: pageParam,
            category,
            city: citySlug,
            sort,
            q,
          },
        });
      }
      return fetchForYouPage({ category, citySlug, cityIdMap, sort, q, cursor: pageParam });
    },
    getNextPageParam: (last) => last.nextCursor,
  });

  const pages = queryResult.data?.pages ?? [];
  const works = pages.flatMap((p) => p.works);
  const isLoading = queryResult.isLoading;
  const isFetchingNext = queryResult.isFetchingNextPage;
  const hasNext = queryResult.hasNextPage;
  const fetchNext = queryResult.fetchNextPage;

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNext) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNext) fetchNext();
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNext, isFetchingNext, fetchNext]);

  const setSearch = (patch: Partial<typeof search>) =>
    navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, ...patch }), replace: true });

  // Geo-default: auto-apply user's home city (or IP-inferred nearest) on first visit
  const defaultCityQuery = useDefaultCity();
  const defaultCity = defaultCityQuery.data?.city ?? null;
  useApplyDefaultCity({
    feedKey: "gallery",
    isWorldwide: citySlug === "all",
    apply: (city) => setSearch({ city: city.slug }),
    defaultCity,
  });

  const categoryTabs: { id: string; label: string }[] = [
    { id: "all", label: "All" },
    ...WORK_CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
  ];

  const filtersActive =
    category !== "all" || citySlug !== "all" || sort !== "recent" || q.trim().length > 0;

  const clearAll = () => {
    setQInput("");
    navigate({
      search: { q: "", tab, cat: "all", city: "all", sort: "recent" },
      replace: true,
    });
  };

  return (
    <main>
      {/* Slim header */}
      <section className="border-b border-border">
        <div className="mx-auto flex max-w-7xl items-end justify-between gap-4 px-4 py-8 md:px-6 md:py-10">
          <div>
            <h1 className="font-display text-3xl text-ink md:text-4xl">Gallery</h1>
            <p className="mt-1 text-sm text-ink-muted">Everything people have shipped — film, music, writing, build, visuals.</p>
          </div>
          <Link to="/works/new" className="shrink-0">
            <Button className="rounded-full">
              <Plus className="h-4 w-4" />
              Post Work
            </Button>
          </Link>
        </div>
      </section>

      {/* Sticky toolbar */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur md:top-14">
        <div className="mx-auto max-w-7xl px-4 py-3 md:px-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="Search works by title or description…"
                className="w-full rounded-full border border-border bg-surface py-2 pl-9 pr-9 text-sm text-ink placeholder:text-ink-muted shadow-soft focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {qInput && (
                <button
                  onClick={() => setQInput("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex gap-1 rounded-full border border-border bg-surface p-1 shadow-soft">
                <button
                  onClick={() => setSearch({ tab: "for-you" })}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm transition",
                    tab === "for-you" ? "bg-ink text-background" : "text-ink-soft hover:bg-muted",
                  )}
                >
                  For you
                </button>
                <button
                  onClick={() => {
                    if (!user) {
                      navigate({ to: "/login" });
                      return;
                    }
                    setSearch({ tab: "following" });
                  }}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm transition",
                    tab === "following" ? "bg-ink text-background" : "text-ink-soft hover:bg-muted",
                  )}
                >
                  Following
                </button>
              </div>

              <div className="flex gap-1 rounded-full border border-border bg-surface p-1 shadow-soft">
                {(["recent", "trending"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSearch({ sort: s })}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-sm capitalize transition",
                      sort === s ? "bg-ink text-background" : "text-ink-soft hover:bg-muted",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Category chips (left) + city filter (right) on desktop; stacked on mobile */}
          <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-3">
            <CategoryScroller
              tabs={categoryTabs}
              value={category}
              onChange={(v) => setSearch({ cat: v })}
              className="md:w-fit"
            />
            <div className="flex items-center gap-2 md:shrink-0">
              <GalleryCityFilter
                cities={cities}
                value={citySlug}
                onChange={(slug) => setSearch({ city: slug })}
              />
              {filtersActive && (
                <button
                  onClick={clearAll}
                  className="rounded-full px-2.5 py-1 text-xs text-ink-muted hover:text-ink"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          <div className="mt-2">
            <GeoDefaultBanner
              defaultCity={defaultCity}
              isOnDefault={!!defaultCity && citySlug === defaultCity.slug}
              isWorldwide={citySlug === "all"}
              onApply={(city) => setSearch({ city: city.slug })}
              onWorldwide={() => setSearch({ city: "all" })}
            />
          </div>
        </div>
      </div>



      {/* Grid */}
      <section className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        {tab === "following" && !user ? (
          <EmptyState
            title="Sign in to see your Following feed"
            body="Follow people, then come back here to see what they're making."
            cta={<Link to="/login"><Button className="rounded-full">Sign in</Button></Link>}
          />
        ) : isLoading ? (
          <Grid>
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-surface-2" />
            ))}
          </Grid>
        ) : works.length === 0 ? (
          tab === "following" ? (
            <EmptyState
              title="Your Following feed is empty"
              body="Follow people on their profiles to fill this up."
              cta={
                <Button onClick={() => setSearch({ tab: "for-you" })} className="rounded-full">
                  Browse For you
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="No works match those filters"
              body="Try clearing filters or a different search."
              cta={
                <Button variant="outline" onClick={clearAll} className="rounded-full">
                  Clear filters
                </Button>
              }
            />
          )
        ) : (
          <>
            <Grid>
              {works.map((w) => <WorkCard key={w.id} work={w} />)}
            </Grid>
            <div ref={sentinelRef} className="h-12" />
            {isFetchingNext && (
              <Grid>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-surface-2" />
                ))}
              </Grid>
            )}
            {!hasNext && works.length > PAGE_SIZE && (
              <p className="mt-8 text-center text-xs text-ink-muted">You've reached the end.</p>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {children}
    </div>
  );
}

function EmptyState({ title, body, cta }: { title: string; body: string; cta?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-surface p-12 text-center">
      <h3 className="font-display text-2xl text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">{body}</p>
      {cta && <div className="mt-5 inline-block">{cta}</div>}
    </div>
  );
}

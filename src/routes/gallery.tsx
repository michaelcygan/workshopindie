import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, Plus } from "lucide-react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { WorkCard, type WorkCardData } from "@/components/work-card";
import type { Category } from "@/lib/categories";
import { FIELD_FILTER_OPTIONS, canonicalFilterValues, normalizeCategory } from "@/lib/taxonomy";
import { categoriesForField } from "@/lib/work-categories";
import { WORK_CARD_SELECT, toWorkCard, type WorkCardRow } from "@/lib/work-card-query";
import { SUBJECT_SUGGESTIONS } from "@/lib/work-tags";
import { CategoryScroller } from "@/components/category-scroller";
import { GalleryCityFilter, type CityOption } from "@/components/gallery-city-filter";
import {
  FilterClear,
  FilterHeader,
  FilterToggleGroup,
} from "@/components/filter-header";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listFollowingWorks } from "@/lib/gallery.functions";
import { useDefaultCity, useApplyDefaultCity } from "@/hooks/use-default-city";
import { useBlockedIds } from "@/hooks/use-blocked-ids";
import { GeoDefaultBanner } from "@/components/geo-default-banner";
import { FreshWorksStrip } from "@/components/fresh-works-strip";
// BoostedWorksStrip retired in v1 distillation pass.
import { GallerySpotlight } from "@/components/gallery/gallery-spotlight";
import { GalleryLoggedOutHero } from "@/components/gallery-logged-out-hero";
import { YourGroupsStrip } from "@/components/your-groups-strip";
import { useMyGroupIdSet } from "@/hooks/use-my-groups";
import { useGroupTagsFor, rerankByMyGroups } from "@/hooks/use-group-tags";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  tab: fallback(z.enum(["for-you", "following", "favorites"]), "for-you").default("for-you"),
  cat: fallback(z.string(), "all").default("all"),
  kind: fallback(z.string(), "all").default("all"),
  subject: fallback(z.string(), "all").default("all"),
  city: fallback(z.string(), "all").default("all"),
  sort: fallback(z.enum(["recent", "trending"]), "recent").default("recent"),
});

export const Route = createFileRoute("/gallery")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Work — Workshop" },
      {
        name: "description",
        content:
          "Browse everything people have published on Workshop. Music, film & video, writing, visual art, games & tech — filter by field, city, and what your network is making.",
      },
      { property: "og:title", content: "Work — Workshop" },
      {
        property: "og:description",
        content: "Browse everything people have published on Workshop.",
      },
      { property: "og:url", content: "https://workshopindie.com/gallery" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://workshopindie.com/gallery" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Work — Workshop",
          description: "Browse everything people have published on Workshop.",
          url: "https://workshopindie.com/gallery",
          isPartOf: { "@type": "WebSite", name: "Workshop", url: "https://workshopindie.com" },
        }),
      },
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
  kind: string;
  subject: string;
  citySlug: string;
  cityIdMap: Map<string, string>;
  sort: "recent" | "trending";
  q: string;
  cursor: string | null;
  blockedIds: string[];
}): Promise<{ works: WorkCardData[]; nextCursor: string | null }> {
  let qb = supabase
    .from("works")
    .select(`${WORK_CARD_SELECT},popularity_score`)
    .eq("status", "published")
    .in("visibility", ["public", "unlisted"])
    .limit(PAGE_SIZE);

  if (params.category !== "all")
    qb = qb.overlaps("categories_canonical", canonicalFilterValues(params.category));
  if (params.kind !== "all") qb = qb.eq("category_id", params.kind);
  if (params.subject !== "all") qb = qb.overlaps("subjects", [params.subject]);
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
  type Row = WorkCardRow & { popularity_score?: number | null; created_by: string };
  const blocked = new Set(params.blockedIds);
  const rows = (data as unknown as Row[]).filter((r) => !blocked.has(r.created_by));
  const works = rows.map(toWorkCard);
  const all = data as unknown as Row[];
  const last = all[all.length - 1];
  const nextCursor =
    params.sort === "recent" && all.length === PAGE_SIZE && last?.published_at
      ? last.published_at
      : null;
  return { works, nextCursor };
}

async function fetchFavoritesPage(params: {
  userId: string;
  category: string;
  kind: string;
  subject: string;
  citySlug: string;
  cityIdMap: Map<string, string>;
  q: string;
  cursor: string | null;
  blockedIds: string[];
}): Promise<{ works: WorkCardData[]; nextCursor: string | null }> {
  let rq = supabase
    .from("work_reactions")
    .select("work_id, created_at")
    .eq("user_id", params.userId)
    .eq("reaction", "like")
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
  if (params.cursor) rq = rq.lt("created_at", params.cursor);
  const { data: reactions, error: rErr } = await rq;
  if (rErr) throw rErr;
  const rxns = (reactions ?? []) as Array<{ work_id: string; created_at: string }>;
  if (rxns.length === 0) return { works: [], nextCursor: null };
  const ids = rxns.map((r) => r.work_id);

  let qb = supabase.from("works").select(WORK_CARD_SELECT).in("id", ids);
  if (params.category !== "all")
    qb = qb.overlaps("categories_canonical", canonicalFilterValues(params.category));
  if (params.kind !== "all") qb = qb.eq("category_id", params.kind);
  if (params.subject !== "all") qb = qb.overlaps("subjects", [params.subject]);
  if (params.citySlug !== "all") {
    const cid = params.cityIdMap.get(params.citySlug);
    if (!cid) return { works: [], nextCursor: null };
    qb = qb.eq("city_id", cid);
  }
  if (params.q.trim()) {
    const s = params.q.trim().replace(/[%,]/g, " ");
    qb = qb.or(`title.ilike.%${s}%,excerpt.ilike.%${s}%`);
  }
  const { data, error } = await qb;
  if (error) throw error;
  type Row = WorkCardRow & { created_by: string };
  const blocked = new Set(params.blockedIds);
  const byId = new Map<string, Row>();
  for (const r of (data ?? []) as unknown as Row[]) {
    if (blocked.has(r.created_by)) continue;
    byId.set(r.id, r);
  }
  // Preserve favorite-order (most recently favorited first).
  const works: WorkCardData[] = [];
  for (const r of rxns) {
    const w = byId.get(r.work_id);
    if (!w) continue;
    works.push(toWorkCard(w));
  }
  const last = rxns[rxns.length - 1];
  const nextCursor = rxns.length === PAGE_SIZE && last ? last.created_at : null;
  return { works, nextCursor };
}

function GalleryPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/gallery" });
  const { user } = useAuth();
  const { ids: blockedIds } = useBlockedIds();
  const blockedKey = useMemo(() => Array.from(blockedIds).sort().join(","), [blockedIds]);
  const [qInput, setQInput] = useState(search.q);
  const [searchOpen, setSearchOpen] = useState(search.q.trim().length > 0);
  const qDebounced = useDebounced(qInput, 250);

  useEffect(() => {
    if (qDebounced !== search.q) {
      navigate({
        search: (prev: Record<string, unknown>) => ({ ...prev, q: qDebounced }),
        replace: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDebounced]);

  const tab = search.tab;
  // Accept legacy values (?cat=film / visual / build) from old shared links.
  const category = search.cat === "all" ? "all" : normalizeCategory(search.cat);
  const kind = search.kind;
  const subject = search.subject;
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
    () => [
      "gallery",
      tab,
      category,
      kind,
      subject,
      citySlug,
      sort,
      q,
      user?.id ?? null,
      blockedKey,
    ],
    [tab, category, kind, subject, citySlug, sort, q, user?.id, blockedKey],
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
            kind,
            subject,
            city: citySlug,
            sort,
            q,
          },
        });
      }
      if (tab === "favorites") {
        if (!user) return { works: [], nextCursor: null };
        return fetchFavoritesPage({
          userId: user.id,
          category,
          kind,
          subject,
          citySlug,
          cityIdMap,
          q,
          cursor: pageParam,
          blockedIds: Array.from(blockedIds),
        });
      }
      return fetchForYouPage({
        category,
        kind,
        subject,
        citySlug,
        cityIdMap,
        sort,
        q,
        cursor: pageParam,
        blockedIds: Array.from(blockedIds),
      });
    },
    getNextPageParam: (last) => last.nextCursor,
  });

  const pages = queryResult.data?.pages ?? [];
  const flatWorks = pages.flatMap((p) => p.works);
  const workIds = useMemo(() => flatWorks.map((w) => w.id), [flatWorks]);
  const { data: groupTagMap } = useGroupTagsFor("work", workIds);
  const myGroupIds = useMyGroupIdSet();
  const works = useMemo(
    () => rerankByMyGroups(flatWorks, groupTagMap, myGroupIds),
    [flatWorks, groupTagMap, myGroupIds],
  );
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
    ...FIELD_FILTER_OPTIONS.map((c) => ({ id: c.id as string, label: c.label })),
  ];

  // Category is scoped to the selected Field; Subject stays a flat discovery cue.
  const kindOptions = category === "all" ? [] : categoriesForField(category);

  const showFeatured =
    tab === "for-you" && category === "all" && kind === "all" && subject === "all" && !q.trim();

  const filtersActive =
    category !== "all" ||
    kind !== "all" ||
    subject !== "all" ||
    citySlug !== "all" ||
    sort !== "recent" ||
    q.trim().length > 0;

  const clearAll = () => {
    setQInput("");
    navigate({
      search: { q: "", tab, cat: "all", kind: "all", subject: "all", city: "all", sort: "recent" },
      replace: true,
    });
  };

  return (
    <main className="pb-mobile-island">
      {/* Logged-out hero with live counters */}
      {!user && <GalleryLoggedOutHero />}

      {/* Slim editorial masthead — title, CTA, and your groups in one band */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-4 md:px-6 md:py-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-3xl leading-none tracking-tight text-ink md:text-4xl">
                Gallery
              </h1>
              <p className="mt-1 truncate text-sm text-ink-muted">
                Everything people made across Workshop — music, film & video, writing, visual art,
                games & tech.
              </p>
            </div>
            <Link to="/works/new" className="shrink-0">
              <Button size="sm" className="rounded-md">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Post to Gallery</span>
                <span className="sm:hidden">Post</span>
              </Button>
            </Link>
          </div>

          {/* Personal groups rail (self-hides when empty) */}
          <YourGroupsStrip variant="inline" className="mt-3" />
        </div>
      </section>

      {/* Sticky one-row toolbar */}
      <FilterHeader stack>

          <div className="relative flex items-center gap-2">
            {/* Tabs (desktop) — the primary lens sits first */}
            <div className="hidden shrink-0 gap-1 rounded-full border border-border bg-surface p-1 shadow-soft lg:flex">
              {(["for-you", "following", "favorites"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    if (t !== "for-you" && !user) {
                      navigate({ to: "/login" });
                      return;
                    }
                    setSearch({ tab: t });
                  }}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs transition",
                    tab === t ? "bg-ink text-background" : "text-ink-soft hover:bg-muted",
                  )}
                >
                  {t === "for-you" ? "For you" : t === "following" ? "Following" : "Favorites"}
                </button>
              ))}
            </div>

            {/* Field chips — single scrolling line + overflow menu */}
            <div className="min-w-0 flex-1">
              <CategoryScroller
                tabs={categoryTabs}
                value={category}
                onChange={(v) => setSearch({ cat: v, kind: "all" })}
              />
            </div>

            {/* Sort */}
            <div className="hidden shrink-0 gap-1 rounded-full border border-border bg-surface p-1 shadow-soft sm:flex">
              {(["recent", "trending"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSearch({ sort: s })}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs capitalize transition",
                    sort === s ? "bg-ink text-background" : "text-ink-soft hover:bg-muted",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* City filter */}
            <div className="hidden shrink-0 md:block">
              <GalleryCityFilter
                cities={cities}
                value={citySlug}
                onChange={(slug) => setSearch({ city: slug })}
              />
            </div>

            {/* Search toggle */}
            <button
              onClick={() => setSearchOpen((v) => !v)}
              className={cn(
                "shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-ink-soft shadow-soft transition hover:bg-muted",
                searchOpen && "bg-ink text-background",
              )}
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>

            {filtersActive && (
              <button
                onClick={clearAll}
                className="hidden shrink-0 rounded-full px-2.5 py-1 text-xs text-ink-muted hover:text-ink md:inline"
              >
                Clear
              </button>
            )}
          </div>

          {/* Category (scoped to the Field) + Subject — the secondary lenses */}
          {(kindOptions.length > 0 || subject !== "all") && (
            <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar">
              {kindOptions.length > 0 && (
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="text-[11px] uppercase tracking-wide text-ink-muted">
                    Category
                  </span>
                  <button
                    onClick={() => setSearch({ kind: "all" })}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition",
                      kind === "all"
                        ? "border-ink bg-ink text-background"
                        : "border-border bg-surface text-ink-soft hover:bg-muted",
                    )}
                  >
                    All
                  </button>
                  {kindOptions.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSearch({ kind: kind === c.id ? "all" : c.id })}
                      className={cn(
                        "shrink-0 rounded-full border px-2.5 py-1 text-xs transition",
                        kind === c.id
                          ? "border-ink bg-ink text-background"
                          : "border-border bg-surface text-ink-soft hover:bg-muted",
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="text-[11px] uppercase tracking-wide text-ink-muted">Subject</span>
                <select
                  value={subject}
                  onChange={(e) => setSearch({ subject: e.target.value })}
                  className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-ink-soft"
                >
                  <option value="all">Any</option>
                  {SUBJECT_SUGGESTIONS.map((sug) => (
                    <option key={sug} value={sug}>
                      {sug}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Expandable search — overlays the row on desktop so it adds no height */}
          {searchOpen && (
            <div className="relative mt-2 md:absolute md:inset-x-4 md:top-2.5 md:z-10 md:mt-0 md:px-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                autoFocus
                placeholder="Search works by title or description…"
                className="w-full rounded-full border border-border bg-surface py-2 pl-9 pr-9 text-sm text-ink placeholder:text-ink-muted shadow-soft focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={() => {
                  setQInput("");
                  setSearchOpen(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                aria-label="Close search"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Mobile-only quick controls: tabs + city */}
          <div className="mt-2 flex items-center gap-2 lg:hidden">
            <div className="flex shrink-0 gap-1 rounded-full border border-border bg-surface p-1 shadow-soft">
              {(["for-you", "following", "favorites"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    if (t !== "for-you" && !user) {
                      navigate({ to: "/login" });
                      return;
                    }
                    setSearch({ tab: t });
                  }}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] transition",
                    tab === t ? "bg-ink text-background" : "text-ink-soft hover:bg-muted",
                  )}
                >
                  {t === "for-you" ? "For you" : t === "following" ? "Following" : "Favorites"}
                </button>
              ))}
            </div>
            <div className="flex shrink-0 gap-1 rounded-full border border-border bg-surface p-1 shadow-soft sm:hidden">
              {(["recent", "trending"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSearch({ sort: s })}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] capitalize transition",
                    sort === s ? "bg-ink text-background" : "text-ink-soft hover:bg-muted",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="ml-auto shrink-0 md:hidden">
              <GalleryCityFilter
                cities={cities}
                value={citySlug}
                onChange={(slug) => setSearch({ city: slug })}
              />
            </div>
            {filtersActive && (
              <button
                onClick={clearAll}
                className="shrink-0 rounded-full px-2 py-1 text-[11px] text-ink-muted hover:text-ink md:hidden"
              >
                Clear
              </button>
            )}
          </div>

          {/* Geo banner — inline, only when actionable */}
          <GeoDefaultBanner
            defaultCity={defaultCity}
            isOnDefault={!!defaultCity && citySlug === defaultCity.slug}
            isWorldwide={citySlug === "all"}
            onApply={(city) => setSearch({ city: city.slug })}
            onWorldwide={() => setSearch({ city: "all" })}
          />
      </FilterHeader>


      {/* Editorial lead-in — only on the default, unfiltered view */}
      {showFeatured && (
        <>
          <GallerySpotlight />
          <FreshWorksStrip className="mt-5 border-y" />
        </>
      )}

      {/* Grid */}
      <section className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-6">
        {(tab === "following" || tab === "favorites") && !user ? (
          <EmptyState
            title={
              tab === "favorites"
                ? "Sign in to see your Favorites"
                : "Sign in to see your Following feed"
            }
            body={
              tab === "favorites"
                ? "Tap the heart on any piece to save it here."
                : "Follow people, then come back here to see what they're making."
            }
            cta={
              <Link to="/login">
                <Button className="rounded-md">Sign in</Button>
              </Link>
            }
          />
        ) : isLoading ? (
          <Grid>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[16/10] animate-pulse rounded-2xl bg-surface-2" />
            ))}
          </Grid>
        ) : works.length === 0 ? (
          tab === "following" ? (
            <EmptyState
              title="Your Following feed is empty"
              body="Follow people on their profiles to fill this up."
              cta={
                <Button onClick={() => setSearch({ tab: "for-you" })} className="rounded-md">
                  Browse For you
                </Button>
              }
            />
          ) : tab === "favorites" ? (
            <EmptyState
              title="Nothing favorited yet"
              body="Tap the heart on any piece to save it here for later."
              cta={
                <Button onClick={() => setSearch({ tab: "for-you" })} className="rounded-md">
                  Browse For you
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="Be the first to publish here"
              body={
                category !== "all" || citySlug !== "all"
                  ? "No pieces in this slice yet. Post yours and start the thread."
                  : "Nothing matches your search. Try fewer filters — or post something new."
              }
              cta={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Link to="/works/new">
                    <Button className="rounded-md">Post to Gallery</Button>
                  </Link>
                  <Button variant="outline" onClick={clearAll} className="rounded-md">
                    Clear filters
                  </Button>
                </div>
              }
            />
          )
        ) : (
          <>
            <Grid>
              {works.map((w) => (
                <WorkCard
                  key={w.id}
                  work={w}
                  groups={groupTagMap?.get(w.id)}
                  myGroupIds={myGroupIds}
                  aspect="16/10"
                />
              ))}
            </Grid>
            <div ref={sentinelRef} className="h-12" />
            {isFetchingNext && (
              <Grid>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="aspect-[16/10] animate-pulse rounded-2xl bg-surface-2" />
                ))}
              </Grid>
            )}
            {!hasNext && works.length > PAGE_SIZE && (
              <p className="mt-8 text-center text-xs text-ink-muted">You've reached the end.</p>
            )}
          </>
        )}
      </section>

      {/* Sticky mobile CTA */}
      <Link to="/works/new" className="fixed bottom-4 right-4 z-40 md:hidden">
        <Button className="rounded-md shadow-lift">
          <Plus className="h-4 w-4" />
          Post to Gallery
        </Button>
      </Link>
    </main>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {children}
    </div>
  );
}

function EmptyState({ title, body, cta }: { title: string; body: string; cta?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
      <h3 className="font-display text-2xl text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">{body}</p>
      {cta && <div className="mt-5 inline-block">{cta}</div>}
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { Plus } from "lucide-react";
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
import type { CityOption } from "@/components/gallery-city-filter";
import {
  FilterClear,
  FilterControls,
  FilterHeader,
  FilterSearch,
  FilterSelect,
  FilterToggleGroup,
} from "@/components/filter-header";
import { FilterCityPicker } from "@/components/filter-header/filter-city-picker";
import { FilterMore, FilterMoreSection } from "@/components/filter-header/filter-more";


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
  topic: fallback(z.string(), "").default(""),
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

type CityChip = CityOption;

type GalleryCityRow = {
  city_id: string | null;
  cities: { id: string; name: string; slug: string; country: string } | null;
  profiles: {
    city_id: string | null;
    cities: { id: string; name: string; slug: string; country: string } | null;
  } | null;
};

async function fetchGalleryCities(): Promise<CityChip[]> {
  // Recent published works with their city — plus the author's home city, so a
  // scene shows up in the picker even when the piece itself has no city set.
  const { data, error } = await supabase
    .from("works")
    .select(
      "city_id, cities(id, name, slug, country), profiles!works_created_by_fkey(city_id, cities!profiles_city_id_fkey(id, name, slug, country))",
    )
    .eq("status", "published")
    .in("visibility", ["public", "unlisted"])
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(1000);
  if (error) return [];
  const map = new Map<string, CityChip>();
  for (const row of (data ?? []) as unknown as GalleryCityRow[]) {
    const c = row.cities ?? row.profiles?.cities ?? null;
    if (!c) continue;
    const ex = map.get(c.id);
    if (ex) ex.count += 1;
    else map.set(c.id, { id: c.id, name: c.name, slug: c.slug, country: c.country, count: 1 });
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Topics that actually appear on published Works, for the Topic filter. */
async function fetchGalleryTopics(): Promise<{ slug: string; name: string; count: number }[]> {
  const { data, error } = await supabase
    .from("work_topics")
    .select("topic:topics(slug,name)")
    .limit(2000);
  if (error) return [];
  const map = new Map<string, { slug: string; name: string; count: number }>();
  for (const row of (data ?? []) as unknown as { topic: { slug: string; name: string } | null }[]) {
    if (!row.topic) continue;
    const ex = map.get(row.topic.slug);
    if (ex) ex.count += 1;
    else map.set(row.topic.slug, { slug: row.topic.slug, name: row.topic.name, count: 1 });
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/** Work ids carrying a topic — used to narrow the feed when a Topic is picked. */
async function fetchWorkIdsForTopic(slug: string): Promise<string[]> {
  const { data: topic } = await supabase.from("topics").select("id").eq("slug", slug).maybeSingle();
  if (!topic) return [];
  const { data } = await supabase
    .from("work_topics")
    .select("work_id")
    .eq("topic_id", (topic as { id: string }).id)
    .limit(1000);
  return ((data ?? []) as { work_id: string }[]).map((r) => r.work_id);
}

/** Author ids who call this city home — city filter falls back to them. */
async function fetchCityAuthorIds(cityId: string): Promise<string[]> {
  const { data } = await supabase.from("profiles").select("id").eq("city_id", cityId).limit(500);
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}


async function fetchForYouPage(params: {
  category: string;
  kind: string;
  subject: string;
  citySlug: string;
  cityIdMap: Map<string, string>;
  cityAuthorIds: string[];
  topicWorkIds: string[] | null;
  sort: "recent" | "trending";
  q: string;
  cursor: string | null;
  blockedIds: string[];
}): Promise<{ works: WorkCardData[]; nextCursor: string | null }> {
  if (params.topicWorkIds && params.topicWorkIds.length === 0)
    return { works: [], nextCursor: null };

  let qb = supabase
    .from("works")
    .select(`${WORK_CARD_SELECT},popularity_score`)
    .eq("status", "published")
    .in("visibility", ["public", "unlisted"])
    .limit(PAGE_SIZE);

  if (params.topicWorkIds) qb = qb.in("id", params.topicWorkIds);
  if (params.category !== "all")
    qb = qb.overlaps("categories_canonical", canonicalFilterValues(params.category));
  if (params.kind !== "all") qb = qb.eq("category_id", params.kind);
  if (params.subject !== "all") qb = qb.overlaps("subjects", [params.subject]);
  if (params.citySlug !== "all") {
    const cid = params.cityIdMap.get(params.citySlug);
    if (!cid) return { works: [], nextCursor: null };
    qb = params.cityAuthorIds.length
      ? qb.or(`city_id.eq.${cid},created_by.in.(${params.cityAuthorIds.join(",")})`)
      : qb.eq("city_id", cid);
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
  cityAuthorIds: string[];
  topicWorkIds: string[] | null;
  q: string;
  cursor: string | null;
  blockedIds: string[];
}): Promise<{ works: WorkCardData[]; nextCursor: string | null }> {
  if (params.topicWorkIds && params.topicWorkIds.length === 0)
    return { works: [], nextCursor: null };

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
  const topicSet = params.topicWorkIds ? new Set(params.topicWorkIds) : null;
  const ids = rxns.map((r) => r.work_id).filter((id) => !topicSet || topicSet.has(id));
  if (ids.length === 0) {
    const lastEmpty = rxns[rxns.length - 1];
    return {
      works: [],
      nextCursor: rxns.length === PAGE_SIZE && lastEmpty ? lastEmpty.created_at : null,
    };
  }

  let qb = supabase.from("works").select(WORK_CARD_SELECT).in("id", ids);
  if (params.category !== "all")
    qb = qb.overlaps("categories_canonical", canonicalFilterValues(params.category));
  if (params.kind !== "all") qb = qb.eq("category_id", params.kind);
  if (params.subject !== "all") qb = qb.overlaps("subjects", [params.subject]);
  if (params.citySlug !== "all") {
    const cid = params.cityIdMap.get(params.citySlug);
    if (!cid) return { works: [], nextCursor: null };
    qb = params.cityAuthorIds.length
      ? qb.or(`city_id.eq.${cid},created_by.in.(${params.cityAuthorIds.join(",")})`)
      : qb.eq("city_id", cid);
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

  const tab = search.tab;
  // Accept legacy values (?cat=film / visual / build) from old shared links.
  const category = search.cat === "all" ? "all" : normalizeCategory(search.cat);
  const kind = search.kind;
  const subject = search.subject;
  const citySlug = search.city;
  const topic = search.topic;
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

  const topicsQuery = useQuery({
    queryKey: ["gallery-topics"],
    queryFn: fetchGalleryTopics,
    staleTime: 5 * 60_000,
  });
  const topicOptions = topicsQuery.data ?? [];

  const topicIdsQuery = useQuery({
    queryKey: ["gallery-topic-works", topic],
    enabled: topic.length > 0,
    staleTime: 60_000,
    queryFn: () => fetchWorkIdsForTopic(topic),
  });
  const topicWorkIds = topic ? (topicIdsQuery.data ?? null) : null;

  const activeCityId = citySlug === "all" ? null : (cityIdMap.get(citySlug) ?? null);
  const cityAuthorsQuery = useQuery({
    queryKey: ["gallery-city-authors", activeCityId],
    enabled: !!activeCityId,
    staleTime: 5 * 60_000,
    queryFn: () => fetchCityAuthorIds(activeCityId as string),
  });
  const cityAuthorIds = cityAuthorsQuery.data ?? [];

  const queryKey = useMemo(
    () => [
      "gallery",
      tab,
      category,
      kind,
      subject,
      citySlug,
      topic,
      sort,
      q,
      user?.id ?? null,
      blockedKey,
      cityAuthorIds.length,
      topicWorkIds?.length ?? null,
    ],
    [
      tab,
      category,
      kind,
      subject,
      citySlug,
      topic,
      sort,
      q,
      user?.id,
      blockedKey,
      cityAuthorIds.length,
      topicWorkIds,
    ],
  );

  const queryResult = useInfiniteQuery({
    queryKey,
    initialPageParam: null as string | null,
    enabled:
      (tab === "for-you" || !!user) &&
      (citySlug === "all" || cities.length > 0) &&
      (!topic || topicIdsQuery.isSuccess),
    queryFn: async ({ pageParam }) => {
      if (tab === "following") {
        const res = await listFollowingWorks({
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
        if (!topicWorkIds) return res;
        const allow = new Set(topicWorkIds);
        return { ...res, works: res.works.filter((w) => allow.has(w.id)) };
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
          cityAuthorIds,
          topicWorkIds,
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
        cityAuthorIds,
        topicWorkIds,
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

  // Category is scoped to the selected Field; Subject stays a flat discovery cue.
  const kindOptions = category === "all" ? [] : categoriesForField(category);

  const cityPickerOptions = useMemo(
    () => cities.map((c) => ({ value: c.slug, label: c.name, count: c.count, hint: c.country })),
    [cities],
  );

  const showFeatured =
    tab === "for-you" &&
    category === "all" &&
    kind === "all" &&
    subject === "all" &&
    !topic &&
    !q.trim();

  const moreCount = (kind !== "all" ? 1 : 0) + (subject !== "all" ? 1 : 0) + (topic ? 1 : 0);

  const filtersActive =
    category !== "all" ||
    kind !== "all" ||
    subject !== "all" ||
    citySlug !== "all" ||
    topic.length > 0 ||
    sort !== "recent" ||
    q.trim().length > 0;

  const clearAll = () => {
    navigate({
      search: {
        q: "",
        tab,
        cat: "all",
        kind: "all",
        subject: "all",
        city: "all",
        topic: "",
        sort: "recent",
      },
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

          {/* Lens tabs — navigation, not a filter, so the sticky bar stays one line */}
          <div className="mt-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <FilterToggleGroup
              className="h-9"
              value={tab}
              onChange={(t) => {
                if (t !== "for-you" && !user) {
                  navigate({ to: "/login" });
                  return;
                }
                setSearch({ tab: t });
              }}
              options={[
                { value: "for-you" as const, label: "For you" },
                { value: "following" as const, label: "Following" },
                { value: "favorites" as const, label: "Favorites" },
              ]}
            />
          </div>

          {/* Personal groups rail (self-hides when empty) */}
          <YourGroupsStrip variant="inline" className="mt-3" />
        </div>
      </section>

      {/* Sticky filter header — same primitive as Blog, Groups and Collabs */}
      <FilterHeader>
        <FilterSearch
          value={q}
          onChange={(next) => setSearch({ q: next })}
          label="Search Gallery"
          placeholder="Search works by title or description…"
        />

        <FilterControls>
          <FilterSelect
            label="Filter by medium"
            width="min-w-[11rem]"
            value={category}
            onChange={(v) => setSearch({ cat: v, kind: "all" })}
          >
            <option value="all">All mediums</option>
            {FIELD_FILTER_OPTIONS.map((c) => (
              <option key={c.id as string} value={c.id as string}>
                {c.label}
              </option>
            ))}
          </FilterSelect>

          <FilterCityPicker
            value={citySlug === "all" ? "" : citySlug}
            onChange={(slug) => setSearch({ city: slug || "all" })}
            options={cityPickerOptions}
          />

          <FilterToggleGroup
            value={sort}
            onChange={(s) => setSearch({ sort: s })}
            options={[
              { value: "recent" as const, label: "Recent" },
              { value: "trending" as const, label: "Trending" },
            ]}
          />

          <FilterMore activeCount={moreCount}>
            {topicOptions.length > 0 ? (
              <FilterMoreSection title="Topic">
                <FilterSelect
                  label="Filter by topic"
                  width="w-full"
                  value={topic}
                  onChange={(v) => setSearch({ topic: v })}
                >
                  <option value="">All topics</option>
                  {topicOptions.map((t) => (
                    <option key={t.slug} value={t.slug}>
                      {t.name}
                    </option>
                  ))}
                </FilterSelect>
              </FilterMoreSection>
            ) : null}

            {kindOptions.length > 0 ? (
              <FilterMoreSection title="Category">
                <FilterSelect
                  label="Filter by category"
                  width="w-full"
                  value={kind}
                  onChange={(v) => setSearch({ kind: v })}
                >
                  <option value="all">All categories</option>
                  {kindOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </FilterSelect>
              </FilterMoreSection>
            ) : null}

            <FilterMoreSection title="Subject">
              <FilterSelect
                label="Filter by subject"
                width="w-full"
                value={subject}
                onChange={(v) => setSearch({ subject: v })}
              >
                <option value="all">Any subject</option>
                {SUBJECT_SUGGESTIONS.map((sug) => (
                  <option key={sug} value={sug}>
                    {sug}
                  </option>
                ))}
              </FilterSelect>
            </FilterMoreSection>
          </FilterMore>

          {filtersActive ? <FilterClear onClick={clearAll} /> : null}
        </FilterControls>
      </FilterHeader>

      {/* Geo banner — inline, only when actionable */}
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <GeoDefaultBanner
          defaultCity={defaultCity}
          isOnDefault={!!defaultCity && citySlug === defaultCity.slug}
          isWorldwide={citySlug === "all"}
          onApply={(city) => setSearch({ city: city.slug })}
          onWorldwide={() => setSearch({ city: "all" })}
        />
      </div>


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

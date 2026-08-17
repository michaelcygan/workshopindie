import { NON_PUBLIC_STATUSES, RECRUITING_DEADLINE_OR } from "@/lib/collab/query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Megaphone, Search, X, MapPin, Briefcase, Radio, Rocket } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CollabCard, type CollabCardData } from "@/components/collab-card";
import { COLLAB_CARD_SELECT } from "@/lib/collab/card-select";

import { CategoryScroller } from "@/components/category-scroller";
import { CityCombobox } from "@/components/city-combobox";
import {
  FILTER_ROW_SCROLL,
  FilterClear,
  FilterHeader,
  FilterPillToggle,
} from "@/components/filter-header";


import { FIELD_FILTER_OPTIONS, canonicalFilterValues, normalizeCategory } from "@/lib/taxonomy";

/** Category filter value: a canonical category id, or "all". */
type CatFilter = string;
import { cn } from "@/lib/utils";
import { useDefaultCity, useApplyDefaultCity } from "@/hooks/use-default-city";
import { useBlockedIds } from "@/hooks/use-blocked-ids";
// Vouch + Boost retired in v1 distillation pass.
import { YourGroupsStrip } from "@/components/your-groups-strip";
import { useMyGroupIdSet } from "@/hooks/use-my-groups";
import { useGroupTagsFor, rerankByMyGroups } from "@/hooks/use-group-tags";
import { PageHeaderCompact } from "@/components/page-header-compact";
import { KickerChip } from "@/components/kicker-chip";



const searchSchema = z.object({
  // Free string so legacy links (?cat=film / visual / build) still resolve; normalized below.
  cat: fallback(z.string(), "all").default("all"),
  city: z.string().uuid().catch(undefined as unknown as string).optional(),
  cityName: z.string().catch(undefined as unknown as string).optional(),
  online: fallback(z.boolean(), false).default(false),
});

export const Route = createFileRoute("/collab/")({
  validateSearch: zodValidator(searchSchema),
  component: CollabPage,
  head: () => ({
    meta: [
      { title: "Collab Board — Workshop" },
      { name: "description", content: "Things people are trying to make. Help out, or post your own and open live audio on it." },
      { property: "og:title", content: "Collab Board — Workshop" },
      { property: "og:description", content: "Things people are trying to make. Help out, or post your own." },
      { property: "og:url", content: "https://workshopindie.com/collab" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://workshopindie.com/collab" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Collab Board — Workshop",
          description: "Open creative collaborations: briefs, roles, and rooms forming now.",
          url: "https://workshopindie.com/collab",
          isPartOf: { "@type": "WebSite", name: "Workshop", url: "https://workshopindie.com" },
        }),
      },
    ],
  }),
});

type Filters = {
  cat: CatFilter;
  city?: string;
  online: boolean;
};

async function fetchPosts({ cat, city, online, blockedIds }: Filters & { blockedIds: string[] }) {
  let q = supabase
    .from("collab_posts")
    .select(COLLAB_CARD_SELECT)

    .is("archived_at", null).not("status", "in", NON_PUBLIC_STATUSES).is("resulting_work_id", null).eq("applications_open", true).or(RECRUITING_DEADLINE_OR())
    .or(`ends_on.is.null,ends_on.gte.${new Date().toISOString().slice(0, 10)}`)
    .order("created_at", { ascending: false })
    .limit(60);

  if (cat !== "all") q = q.overlaps("categories_canonical", canonicalFilterValues(cat));
  if (online) {
    q = q.eq("location_mode", "online");
  } else if (city) {
    // City selected: include posts in that city, posts open to that city, or online posts.
    q = q.or(`city_id.eq.${city},also_cities.cs.{${city}},location_mode.eq.online`);
  }

  const { data, error } = await q;
  if (error) throw error;
  const blocked = new Set(blockedIds);
  const rows = ((data ?? []) as unknown as (CollabCardData & { user_id: string })[])
    .filter((r) => !blocked.has(r.user_id)) as CollabCardData[];

  // Light blended sort: newest first, gentle lift for posts that are more open
  // (more roles listed, or accepting suggestions). Deterministic and readable.
  return rows
    .slice()
    .sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      const openness = (r: CollabCardData) =>
        (r.roles?.length ?? 0) + (r.accepts_suggestions ? 1 : 0);
      const ra = openness(a) * 1000 * 60 * 60 * 6;
      const rb = openness(b) * 1000 * 60 * 60 * 6;
      return tb + rb - (ta + ra);
    });
}

// City filtering uses the shared, ranked CityCombobox (see components/city-combobox).


function CollabPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/collab" });

  const filters: Filters = useMemo(
    () => ({
      cat: search.cat === "all" ? "all" : normalizeCategory(search.cat),
      city: search.city,
      online: search.online,
    }),
    [search.cat, search.city, search.online],
  );

  const { ids: blockedIds } = useBlockedIds();
  const blockedKey = useMemo(() => Array.from(blockedIds).sort().join(","), [blockedIds]);

  const qc = useQueryClient();

  const { data: rawPosts, isLoading } = useQuery({
    queryKey: ["collab", filters, blockedKey],
    queryFn: () => fetchPosts({ ...filters, blockedIds: Array.from(blockedIds) }),
    staleTime: 30_000,
  });

  const postIds = useMemo(() => (rawPosts ?? []).map((p) => p.id), [rawPosts]);
  const { data: groupTagMap } = useGroupTagsFor("collab", postIds);
  const myGroupIds = useMyGroupIdSet();
  const posts = useMemo(
    () => rerankByMyGroups(rawPosts ?? [], groupTagMap, myGroupIds),
    [rawPosts, groupTagMap, myGroupIds],
  );

  // Live Collabs (have a running Lounge)
  const livePosts = useMemo(() => (posts ?? []).filter((p) => !!p.live_workshop_id), [posts]);


  const tabs = useMemo(
    () => [
      { id: "all" as const, label: "All" },
      ...FIELD_FILTER_OPTIONS.map((c) => ({ id: c.id as string, label: c.label })),
    ],
    [],
  );

  type SearchShape = { cat: CatFilter; city?: string; cityName?: string; online: boolean };
  function setCat(next: CatFilter) {
    navigate({ search: (prev: SearchShape) => ({ ...prev, cat: next }) });
  }
  function setCity(next: { id?: string; name?: string }) {
    navigate({ search: (prev: SearchShape) => ({ ...prev, city: next.id, cityName: next.name }) });
  }
  function toggleOnline() {
    navigate({
      search: (prev: SearchShape) => ({
        ...prev,
        online: !prev.online,
        // If switching ON, clear city since it's irrelevant for online-only.
        city: !prev.online ? undefined : prev.city,
        cityName: !prev.online ? undefined : prev.cityName,
      }),
    });
  }

  const { user } = useAuth();
  const defaultCityQuery = useDefaultCity();
  const defaultCity = defaultCityQuery.data?.city ?? null;
  useApplyDefaultCity({
    feedKey: "collab",
    isWorldwide: !filters.city && !filters.online,
    apply: (city) => setCity({ id: city.id, name: city.name }),
    defaultCity,
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <YourGroupsStrip className="-mx-4 -mt-6 mb-6 rounded-none border-b md:-mx-6 md:-mt-8" />

      <PageHeaderCompact
        title="Collab Board"
        right={
          <div className="flex flex-wrap items-center gap-2">
            {user && (
              <Link to="/me/collabs">
                <Button variant="outline" size="sm" className="rounded-md gap-2">
                  <Briefcase className="h-4 w-4" /> My Collabs
                </Button>
              </Link>
            )}
            <Link to="/collab/new">
              <Button size="sm" className="rounded-md gap-2">
                <Megaphone className="h-4 w-4" /> Post Collab
              </Button>
            </Link>
          </div>
        }
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <KickerChip live={livePosts.length > 0}>
          {livePosts.length > 0 ? `${livePosts.length} live now` : "Start a Collab"}
        </KickerChip>
        <p className="text-sm text-ink-muted">
          What people are trying to make. Help out — or open live audio on yours.
        </p>
        {rawPosts && rawPosts.length > 0 && (
          <span className="ml-auto rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] font-medium text-ink-soft">
            {rawPosts.length} open
          </span>
        )}
      </div>

      {/* Sticky filter header */}
      <FilterHeader inset stack className="mt-4">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <CategoryScroller tabs={tabs} value={filters.cat} onChange={setCat} className="w-full" />
          </div>
          <div className="hidden min-w-[15rem] shrink-0 md:block">
            <CityCombobox
              value={
                filters.city ? { id: filters.city, name: search.cityName ?? "Selected city" } : null
              }
              onChange={(next) => setCity({ id: next?.id, name: next?.name })}
              disabled={filters.online}
            />
          </div>
          <FilterPillToggle
            active={filters.online}
            onClick={toggleOnline}
            label="Toggle online-only Collabs"
            className="hidden sm:inline-flex"
          >
            Online only
          </FilterPillToggle>
          {(filters.online || filters.city || filters.cat !== "all") && (
            <FilterClear
              onClick={() =>
                navigate({
                  search: () => ({ cat: "all", online: false }),
                  replace: true,
                })
              }
            />
          )}
        </div>

        <div className={cn(FILTER_ROW_SCROLL, "mt-2 md:hidden")}>
          <div className="min-w-[14rem] flex-1">
            <CityCombobox
              value={
                filters.city ? { id: filters.city, name: search.cityName ?? "Selected city" } : null
              }
              onChange={(next) => setCity({ id: next?.id, name: next?.name })}
              disabled={filters.online}
            />
          </div>
          <FilterPillToggle
            active={filters.online}
            onClick={toggleOnline}
            label="Toggle online-only Collabs"
            className="sm:hidden"
          >
            Online only
          </FilterPillToggle>
        </div>
      </FilterHeader>

      <div className="mt-3 space-y-1">
        {defaultCity && filters.city === defaultCity.id && defaultCity.source === "ip" && (
          <p className="px-1 text-xs text-ink-muted">
            Based on your location ·{" "}
            <button
              type="button"
              onClick={() => setCity({ id: undefined, name: undefined })}
              className="underline underline-offset-2 hover:text-ink"
            >
              see worldwide
            </button>
          </p>
        )}
        {!filters.city && !filters.online && defaultCity && (
          <p className="px-1 text-xs text-ink-muted">
            Near you:{" "}
            <button
              type="button"
              onClick={() => setCity({ id: defaultCity.id, name: defaultCity.name })}
              className="text-ink underline underline-offset-2 hover:text-primary"
            >
              {defaultCity.name}
            </button>
          </p>
        )}
      </div>


      {/* Live Collabs strip */}
      {livePosts.length > 0 && (
        <div className="mt-10">
          <div className="mb-3 flex items-center gap-2 px-1">
            <Radio className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg text-ink">Live right now</h2>
            <span className="text-xs text-ink-muted">— live audio on these Collabs is running</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 md:-mx-6 md:px-6 [scrollbar-width:thin]">
            {livePosts.map((p) => (
              <Link
                key={p.id}
                to="/collab/$slug"
                params={{ slug: p.slug }}
                className="group relative flex min-w-[260px] max-w-[280px] shrink-0 flex-col gap-1.5 rounded-2xl border border-primary/30 bg-surface p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-primary">Live</span>
                  <span className="ml-auto text-[11px] text-ink-muted">{p.user?.display_name ?? p.user?.username ?? "Host"}</span>
                </div>
                <div className="font-display text-base text-ink line-clamp-2">{p.title}</div>
              </Link>
            ))}
          </div>
        </div>
      )}


      <div className="mt-10">
        <div className="mb-3 flex items-center gap-3 px-1">
          <h2 className="font-display text-lg text-ink">Collabs looking for people</h2>
          <span className="h-px flex-1 bg-border" />
        </div>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-56 animate-pulse rounded-xl bg-surface-2" />
            ))}
          </div>
        ) : !posts || posts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
            <h3 className="font-display text-2xl text-ink">
              {filters.city || filters.online ? "Nothing open here yet." : "Nothing open right now."}
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
              {filters.city
                ? "Be the first — post one and the right people will see it."
                : "Post yours — list the roles, the people show up."}
            </p>
            <Link to="/collab/new" className="mt-5 inline-block">
              <Button className="rounded-md">Post a Collab</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {posts.map((p) => (
              <CollabCard key={p.id} post={p} groups={groupTagMap?.get(p.id)} myGroupIds={myGroupIds} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

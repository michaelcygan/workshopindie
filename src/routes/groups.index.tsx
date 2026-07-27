import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { GroupCard, type GroupCardData } from "@/components/group-card";
import { GroupFeaturedCard } from "@/components/group-featured-card";
import { GroupsKindSwitcher, type KindTab } from "@/components/groups-kind-switcher";
import { PageHeaderCompact } from "@/components/page-header-compact";
import { useGroupMemberAvatars } from "@/hooks/use-group-member-avatars";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TAB_VALUES = ["for-you", "city", "genre", "micro", "scene", "all"] as const;
type Tab = KindTab;

const CATEGORY_VALUES = [
  "all",
  "city",
  "music",
  "film_video",
  "writing",
  "visual_art",
  "games_tech",
  "performance",
  "audio",
  "scene_life",
] as const;
type Category = (typeof CATEGORY_VALUES)[number];

const CATEGORY_LABELS: Record<Category, string> = {
  all: "All categories",
  city: "Cities",
  music: "Music",
  film_video: "Film & Video",
  writing: "Writing",
  visual_art: "Visual Art",
  games_tech: "Games & Tech",
  performance: "Performance",
  audio: "Audio",
  scene_life: "Scene & Lifestyle",
};

const KIND_LABELS: Record<GroupCardData["kind"], string> = {
  city: "City",
  genre: "Genre",
  micro: "Micro",
  scene: "Scene",
};

const SORT_VALUES = ["featured", "members", "content", "az"] as const;
type Sort = (typeof SORT_VALUES)[number];

const SORT_LABELS: Record<Sort, string> = {
  featured: "Featured",
  members: "Most members",
  content: "Most content",
  az: "A–Z",
};

const searchSchema = z.object({
  t: fallback(z.enum(TAB_VALUES), "all").default("all"),
  q: fallback(z.string(), "").default(""),
  c: fallback(z.enum(CATEGORY_VALUES), "all").default("all"),
  s: fallback(z.enum(SORT_VALUES), "featured").default("featured"),
});

export const Route = createFileRoute("/groups/")({
  validateSearch: zodValidator(searchSchema),
  component: GroupsIndex,
  head: () => ({
    meta: [
      { title: "Groups — Workshop" },
      {
        name: "description",
        content:
          "Find the people, places, and creative movements your work belongs with.",
      },
      { property: "og:title", content: "Groups — Workshop" },
      {
        property: "og:description",
        content:
          "Find the people, places, and creative movements your work belongs with.",
      },
      { property: "og:url", content: "https://workshopindie.com/groups" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Groups — Workshop" },
      {
        name: "twitter:description",
        content:
          "Find the people, places, and creative movements your work belongs with.",
      },
    ],
    links: [{ rel: "canonical", href: "https://workshopindie.com/groups" }],
  }),
});

const PAGE_SIZE = 24;
const FEATURED_MAX = 4;
const FEATURED_MIN = 2;

const TITLE_BY_TAB: Record<Tab, string> = {
  all: "Explore groups",
  "for-you": "Your groups",
  genre: "Genres",
  scene: "Scenes",
  micro: "Micro Groups",
  city: "Cities",
};

function matchesSearch(group: GroupCardData, needle: string): boolean {
  if (!needle) return true;
  const categoryLabel =
    group.category && (CATEGORY_LABELS as Record<string, string>)[group.category]
      ? CATEGORY_LABELS[group.category as Category]
      : "";
  const hay = [group.name, group.tagline ?? "", KIND_LABELS[group.kind], categoryLabel]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
  return hay.includes(needle);
}

function sortGroups(rows: GroupCardData[], sort: Sort): GroupCardData[] {
  const copy = rows.slice();
  const byName = (a: GroupCardData, b: GroupCardData) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  switch (sort) {
    case "members":
      return copy.sort((a, b) => b.member_count - a.member_count || byName(a, b));
    case "content":
      return copy.sort(
        (a, b) =>
          b.work_count + b.collab_count + b.workshop_count -
            (a.work_count + a.collab_count + a.workshop_count) || byName(a, b),
      );
    case "az":
      return copy.sort(byName);
    case "featured":
    default:
      return copy.sort((a, b) => {
        const af = a.featured_at ? Date.parse(a.featured_at) : 0;
        const bf = b.featured_at ? Date.parse(b.featured_at) : 0;
        if (af !== bf) return bf - af;
        if (a.member_count !== b.member_count) return b.member_count - a.member_count;
        return byName(a, b);
      });
  }
}

function GroupsIndex() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const tab: Tab = search.t;
  const query = search.q;
  const category: Category = search.c;
  const sort: Sort = search.s;

  const setTab = (t: Tab) =>
    navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, t }), replace: true });
  const setQuery = (q: string) =>
    navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, q }), replace: true });
  const setCategory = (c: Category) =>
    navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, c }), replace: true });
  const setSort = (s: Sort) =>
    navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, s }), replace: true });

  const resetAll = () =>
    navigate({
      search: () => ({ t: "all" as Tab, q: "", c: "all" as Category, s: "featured" as Sort }),
      replace: true,
    });

  const { data: allGroups = [], isLoading } = useQuery({
    queryKey: ["groups", "all"],
    queryFn: async (): Promise<GroupCardData[]> => {
      const { data } = await supabase
        .from("groups")
        .select(
          "id,slug,name,tagline,kind,cover_url,avatar_url,accent_color,member_count,workshop_count,collab_count,work_count,is_official,featured_at,category",
        )
        .is("deleted_at", null)
        .eq("visibility", "public")
        .order("featured_at", { ascending: false, nullsFirst: false })
        .order("member_count", { ascending: false })
        .limit(200);
      return (data ?? []) as unknown as GroupCardData[];
    },
  });

  const { data: myIds = [] } = useQuery({
    queryKey: ["my-group-ids", user?.id ?? "anon"],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user!.id);
      return (data ?? []).map((r) => r.group_id as string);
    },
    staleTime: 30_000,
  });

  const myIdSet = useMemo(() => new Set(myIds), [myIds]);

  const kindCounts = useMemo(
    () => ({
      all: allGroups.length,
      "for-you": allGroups.filter((g) => myIdSet.has(g.id)).length,
      genre: allGroups.filter((g) => g.kind === "genre").length,
      scene: allGroups.filter((g) => g.kind === "scene").length,
      micro: allGroups.filter((g) => g.kind === "micro").length,
      city: allGroups.filter((g) => g.kind === "city").length,
    }),
    [allGroups, myIdSet],
  ) satisfies Record<Tab, number>;

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    let rows = allGroups;
    if (tab === "for-you") {
      rows = rows.filter((g) => myIdSet.has(g.id));
    } else if (tab !== "all") {
      rows = rows.filter((g) => g.kind === tab);
    }
    if (category !== "all") {
      rows = rows.filter((g) => g.category === category);
    }
    if (q) rows = rows.filter((g) => matchesSearch(g, q));
    return sortGroups(rows, sort);
  }, [allGroups, tab, query, category, sort, myIdSet]);

  // Featured rail: only on the pristine All view.
  const showFeatured =
    tab === "all" && !query.trim() && category === "all" && sort === "featured";
  const featured = useMemo(() => {
    if (!showFeatured) return [];
    return allGroups.filter((g) => !!g.featured_at).slice(0, FEATURED_MAX);
  }, [allGroups, showFeatured]);
  const showFeaturedRail = featured.length >= FEATURED_MIN;

  // Progressive rendering.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [tab, query, category, sort]);
  const visibleRows = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );

  // Batched avatar fetch — covers featured rail + first page of directory.
  const avatarIds = useMemo(() => {
    const ids = new Set<string>();
    featured.forEach((g) => ids.add(g.id));
    visibleRows.slice(0, 32).forEach((g) => ids.add(g.id));
    return Array.from(ids);
  }, [featured, visibleRows]);
  const { data: avatarMap } = useGroupMemberAvatars(avatarIds);

  const filtersActive =
    tab !== "all" || category !== "all" || sort !== "featured" || !!query.trim();

  const resultsTitle = query.trim() ? "Search results" : TITLE_BY_TAB[tab];
  const showSuggestFooter = !isLoading && filtered.length > 0;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      {/* Editorial header */}
      <PageHeaderCompact title="Groups" />
      <p className="mt-3 max-w-2xl text-sm text-ink-muted md:text-base">
        Find the people, places, and creative movements your work belongs with.
      </p>

      {/* Sticky discovery bar: search + kind switcher */}
      <div className="sticky top-0 z-30 -mx-4 mt-5 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <label className="flex h-12 items-center gap-2 rounded-full border border-border bg-surface px-4 shadow-soft">
          <Search className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
          <span className="sr-only">Search groups</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search groups, cities, scenes, or languages…"
            aria-label="Search groups"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-muted/70 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-muted transition hover:bg-muted hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
        <div className="mt-3">
          <GroupsKindSwitcher
            value={tab}
            counts={kindCounts}
            authenticated={!!user}
            onChange={setTab}
          />
        </div>
      </div>

      {/* Featured Groups rail */}
      {showFeaturedRail && (
        <section className="mt-6">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-lg text-ink md:text-xl">Featured Groups</h2>
            <span className="text-xs text-ink-muted">{featured.length} handpicked</span>
          </div>
          <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:snap-none md:grid-cols-3 md:overflow-visible md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {featured.map((g) => (
              <div
                key={g.id}
                className="w-[85vw] shrink-0 snap-start sm:w-[70vw] md:w-auto"
              >
                <GroupFeaturedCard
                  group={g}
                  joined={myIdSet.has(g.id)}
                  avatars={avatarMap?.get(g.id)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Results toolbar */}
      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-xl text-ink md:text-2xl">{resultsTitle}</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {isLoading
                ? "Loading…"
                : `${filtered.length.toLocaleString()} ${filtered.length === 1 ? "result" : "results"}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {tab !== "city" && (
              <div className="flex items-center gap-1.5">
                <span className="sr-only" id="category-label">Category</span>
                <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                  <SelectTrigger
                    aria-labelledby="category-label"
                    className={cn(
                      "h-9 rounded-full border-border bg-surface text-xs",
                      category !== "all" && "border-ink bg-ink text-background",
                    )}
                  >
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {CATEGORY_VALUES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className="sr-only" id="sort-label">Sort</span>
              <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
                <SelectTrigger
                  aria-labelledby="sort-label"
                  className="h-9 rounded-full border-border bg-surface text-xs"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {SORT_VALUES.map((s) => (
                    <SelectItem key={s} value={s}>
                      Sort: {SORT_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {filtersActive && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 rounded-full text-xs"
                onClick={resetAll}
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {/* Directory */}
        <div className="mt-5">
          {tab === "for-you" && !user ? (
            <EmptyState
              title="Sign in to see your Groups."
              body="The communities you join will appear here."
              primary={
                <Link
                  to="/login"
                  className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-background"
                >
                  Sign in
                </Link>
              }
              secondary={
                <button
                  type="button"
                  onClick={() => setTab("all")}
                  className="text-sm text-ink-soft underline-offset-2 hover:underline"
                >
                  Browse all Groups
                </button>
              }
            />
          ) : isLoading ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-40 animate-pulse rounded-2xl bg-surface-2" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            query.trim() ? (
              <EmptyState
                title="No Groups match that search."
                body="Try a different word — a city, scene, medium, or language."
                primary={
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-background"
                  >
                    Clear search
                  </button>
                }
              />
            ) : tab === "for-you" ? (
              <EmptyState
                title="You haven't joined any Groups yet."
                body="Browse the communities where your work, interests, and city belong."
                primary={
                  <button
                    type="button"
                    onClick={() => setTab("all")}
                    className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-background"
                  >
                    Explore Groups
                  </button>
                }
              />
            ) : (
              <EmptyState
                title={`No ${TITLE_BY_TAB[tab].toLowerCase()} match those filters.`}
                body="Adjust the category or sort to see more."
                primary={
                  <button
                    type="button"
                    onClick={resetAll}
                    className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-background"
                  >
                    Reset filters
                  </button>
                }
              />
            )
          ) : (
            <>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {visibleRows.map((g) => (
                  <GroupCard
                    key={g.id}
                    group={g}
                    joined={myIdSet.has(g.id)}
                    avatars={avatarMap?.get(g.id)}
                  />
                ))}
              </div>
              <ShowMore
                total={filtered.length}
                visible={visibleRows.length}
                onMore={() =>
                  setVisibleCount((n) => Math.min(n + PAGE_SIZE, filtered.length))
                }
              />
            </>
          )}
        </div>

        {/* Suggest a group footer */}
        {showSuggestFooter && (
          <div className="mt-10 rounded-3xl border border-dashed border-border bg-surface p-6 text-center md:p-8">
            <h3 className="font-display text-lg text-ink md:text-xl">Missing a community?</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
              Suggest a Group and tell us where your work belongs.
            </p>
            <div className="mt-4">
              <a
                href="mailto:hello@workshopindie.com?subject=Suggest%20a%20group"
                className="inline-flex items-center rounded-full bg-ink px-4 py-2 text-sm font-medium text-background hover:bg-ink/90"
              >
                Suggest a Group
              </a>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function EmptyState({
  title,
  body,
  primary,
  secondary,
}: {
  title: string;
  body?: string;
  primary?: React.ReactNode;
  secondary?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-surface p-10 text-center md:p-12">
      <h3 className="font-display text-xl text-ink md:text-2xl">{title}</h3>
      {body && <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">{body}</p>}
      {(primary || secondary) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {primary}
          {secondary}
        </div>
      )}
    </div>
  );
}

function ShowMore({
  total,
  visible,
  onMore,
}: {
  total: number;
  visible: number;
  onMore: () => void;
}) {
  const remaining = total - visible;
  return (
    <div className="mt-8 flex flex-col items-center gap-2 border-t border-border/60 pt-6 text-center">
      <p className="text-xs text-ink-muted">
        Showing {visible.toLocaleString()} of {total.toLocaleString()}{" "}
        {total === 1 ? "group" : "groups"}
      </p>
      {remaining > 0 ? (
        <button
          type="button"
          onClick={onMore}
          className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-muted"
        >
          {remaining >= PAGE_SIZE
            ? `Show ${PAGE_SIZE} more`
            : `Show remaining ${remaining}`}
        </button>
      ) : (
        <p className="text-xs text-ink-muted/80">That's every group.</p>
      )}
    </div>
  );
}

/**
 * The one Collab Board.
 *
 * Rendered by `/collab` and by `/collab/remote` — the second is the same board
 * with the existing Remote (`location_mode = "online"`) filter active on entry.
 * There is no second feed, card, query or lifecycle: the route only decides the
 * initial format and how format changes navigate.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Megaphone, Briefcase } from "lucide-react";
import { NON_PUBLIC_STATUSES, RECRUITING_DEADLINE_OR } from "@/lib/collab/query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { CollabCard, type CollabCardData } from "@/components/collab-card";
import { COLLAB_CARD_SELECT } from "@/lib/collab/card-select";
import {
  FilterClear,
  FilterControls,
  FilterHeader,
  FilterMeta,
  FilterSearch,
  FilterSelect,
  FilterToggleGroup,
} from "@/components/filter-header";
import { FilterCityPicker } from "@/components/filter-header/filter-city-picker";
import {
  FilterMore,
  FilterMoreSection,
  FilterMoreToggle,
} from "@/components/filter-header/filter-more";
import { FIELD_FILTER_OPTIONS, canonicalFilterValues, normalizeCategory } from "@/lib/taxonomy";
import { useDefaultCity, useApplyDefaultCity } from "@/hooks/use-default-city";
import { useBlockedIds } from "@/hooks/use-blocked-ids";
import { YourGroupsStrip } from "@/components/your-groups-strip";
import { useMyGroupIdSet } from "@/hooks/use-my-groups";
import { useGroupTagsFor, rerankByMyGroups } from "@/hooks/use-group-tags";

/** Remote is the user-facing word; `online` stays the stored enum value. */
export type Format = "any" | "in_person" | "online";
export type Comp = "any" | "paid" | "unpaid";

export type BoardSearch = {
  cat: string;
  city?: string;
  cityName?: string;
  topic: string;
  comp: string;
  sug: boolean;
};

type Filters = {
  cat: string;
  city?: string;
  format: Format;
  topic: string;
};

/** Collab ids carrying a canonical Topic — resolved before the board is limited. */
async function topicPostIds(slug: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("collab_post_topics")
    .select("collab_post_id,topic:topics!inner(slug)")
    .eq("topic.slug", slug)
    .limit(2000);
  if (error) throw error;
  return ((data ?? []) as unknown as { collab_post_id: string }[]).map((r) => r.collab_post_id);
}

async function fetchPosts({ cat, format, topic, blockedIds }: Filters & { blockedIds: string[] }) {
  let ids: string[] | null = null;
  if (topic) {
    ids = await topicPostIds(topic);
    if (ids.length === 0) return [] as CollabCardData[];
  }

  let q = supabase
    .from("collab_posts")
    .select(COLLAB_CARD_SELECT)

    .is("archived_at", null)
    .not("status", "in", NON_PUBLIC_STATUSES)
    .is("resulting_work_id", null)
    .eq("applications_open", true)
    .or(RECRUITING_DEADLINE_OR());

  if (ids) q = q.in("id", ids);
  if (cat !== "all") q = q.overlaps("categories_canonical", canonicalFilterValues(cat));
  if (format === "online") {
    q = q.eq("location_mode", "online");
  } else if (format === "in_person") {
    q = q.in("location_mode", ["in_person", "hybrid"]);
    // City is refined client-side so a post can also match its author's home city.
  }

  const { data, error } = await q.order("created_at", { ascending: false }).limit(60);
  if (error) throw error;
  const blocked = new Set(blockedIds);
  const rows = ((data ?? []) as unknown as (CollabCardData & { user_id: string })[]).filter(
    (r) => !blocked.has(r.user_id),
  ) as CollabCardData[];

  // Light blended sort: newest first, gentle lift for posts that are more open
  // (more roles listed, or accepting suggestions). Deterministic and readable.
  return rows.slice().sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    const openness = (r: CollabCardData) =>
      (r.roles?.length ?? 0) + (r.accepts_suggestions ? 1 : 0);
    const ra = openness(a) * 1000 * 60 * 60 * 6;
    const rb = openness(b) * 1000 * 60 * 60 * 6;
    return tb + rb - (ta + ra);
  });
}

/**
 * A Collab counts for a city when it is posted there, opened to it, or its
 * author calls that city home — most posts are remote with no city of their own.
 */
export function collabCityIds(p: {
  city_id?: string | null;
  also_cities?: string[] | null;
  user?: { city_id?: string | null } | null;
}) {
  const ids = new Set<string>();
  if (p.city_id) ids.add(p.city_id);
  for (const id of p.also_cities ?? []) if (id) ids.add(id);
  if (p.user?.city_id) ids.add(p.user.city_id);
  return ids;
}

/** Cities that actually have open Collabs — the city picker's option list. */
function useCollabCities() {
  return useQuery({
    queryKey: ["collab-cities"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collab_posts")
        .select(
          "city_id,also_cities,city:cities!collab_posts_city_id_fkey(name)," +
            "user:profiles!collab_posts_user_id_fkey(city_id,city:cities!profiles_city_id_fkey(name))",
        )
        .is("archived_at", null)
        .not("status", "in", NON_PUBLIC_STATUSES)
        .limit(500);
      if (error) throw error;
      const counts = new Map<string, { value: string; label: string; count: number }>();
      const names = new Map<string, string>();
      const rows = (data ?? []) as unknown as {
        city_id: string | null;
        also_cities: string[] | null;
        city: { name: string } | null;
        user: { city_id: string | null; city: { name: string } | null } | null;
      }[];
      for (const row of rows) {
        if (row.city_id && row.city?.name) names.set(row.city_id, row.city.name);
        if (row.user?.city_id && row.user.city?.name)
          names.set(row.user.city_id, row.user.city.name);
      }
      for (const row of rows) {
        for (const id of collabCityIds(row)) {
          const label = names.get(id);
          if (!label) continue;
          const hit = counts.get(id);
          if (hit) hit.count += 1;
          else counts.set(id, { value: id, label, count: 1 });
        }
      }
      return Array.from(counts.values()).sort(
        (a, b) => b.count - a.count || a.label.localeCompare(b.label),
      );
    },
  });
}

/**
 * Canonical Topics attached to Collabs that are actually eligible for the board
 * (not merely those in the first loaded page of results).
 */
function useCollabTopicOptions(format: Format) {
  return useQuery({
    queryKey: ["collab-topic-options", format],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      let eligible = supabase
        .from("collab_posts")
        .select("id")
        .is("archived_at", null)
        .not("status", "in", NON_PUBLIC_STATUSES)
        .is("resulting_work_id", null)
        .eq("applications_open", true)
        .or(RECRUITING_DEADLINE_OR())
        .limit(1000);
      if (format === "online") eligible = eligible.eq("location_mode", "online");
      else if (format === "in_person") eligible = eligible.in("location_mode", ["in_person", "hybrid"]);

      const { data: rows, error } = await eligible;
      if (error) throw error;
      const ids = ((rows ?? []) as { id: string }[]).map((r) => r.id);
      if (ids.length === 0) return [] as { slug: string; name: string }[];

      const { data, error: tErr } = await supabase
        .from("collab_post_topics")
        .select("topic:topics(slug,name)")
        .in("collab_post_id", ids)
        .limit(2000);
      if (tErr) throw tErr;
      const names = new Map<string, string>();
      for (const row of (data ?? []) as unknown as { topic: { slug: string; name: string } | null }[]) {
        if (row.topic) names.set(row.topic.slug, row.topic.name);
      }
      return Array.from(names.entries())
        .map(([slug, name]) => ({ slug, name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

export type CollabBoardProps = {
  search: BoardSearch;
  format: Format;
  /** True on `/collab/remote`: the city dimension does not constrain results. */
  remote: boolean;
  title: string;
  description: string;
  onPatch: (next: Partial<BoardSearch>) => void;
  onFormatChange: (next: Format) => void;
  onClear: () => void;
};

export function CollabBoard({
  search,
  format,
  remote,
  title,
  description,
  onPatch,
  onFormatChange,
  onClear,
}: CollabBoardProps) {
  const [query, setQuery] = useState("");
  const comp: Comp = search.comp === "paid" || search.comp === "unpaid" ? search.comp : "any";

  const filters: Filters = useMemo(
    () => ({
      cat: search.cat === "all" ? "all" : normalizeCategory(search.cat),
      city: format === "online" ? undefined : search.city,
      format,
      topic: search.topic,
    }),
    [search.cat, search.city, search.topic, format],
  );

  const { ids: blockedIds } = useBlockedIds();
  const blockedKey = useMemo(() => Array.from(blockedIds).sort().join(","), [blockedIds]);

  const { data: rawPosts, isLoading } = useQuery({
    queryKey: ["collab", filters, blockedKey],
    queryFn: () => fetchPosts({ ...filters, blockedIds: Array.from(blockedIds) }),
    staleTime: 30_000,
  });

  const postIds = useMemo(() => (rawPosts ?? []).map((p) => p.id), [rawPosts]);
  const { data: groupTagMap } = useGroupTagsFor("collab", postIds);
  const myGroupIds = useMyGroupIdSet();
  const { data: cityOptions = [] } = useCollabCities();
  const { data: topicOptions = [] } = useCollabTopicOptions(format);

  const ranked = useMemo(
    () => rerankByMyGroups(rawPosts ?? [], groupTagMap, myGroupIds),
    [rawPosts, groupTagMap, myGroupIds],
  );

  // Client-side refinements: keyword and the overflow filters. Topic + medium
  // are already applied in the query, before limiting.
  const posts = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return ranked.filter((p) => {
      if (comp === "paid" && p.compensation_type !== "paid") return false;
      if (comp === "unpaid" && !["unpaid", "credit"].includes(p.compensation_type)) return false;
      if (search.sug && !p.accepts_suggestions) return false;
      if (filters.city && !collabCityIds(p as never).has(filters.city)) return false;
      if (q) {
        const haystack = [p.title, p.description ?? "", ...(p.roles ?? []).map((r) => r.role_name)]
          .join(" ")
          .toLocaleLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [ranked, query, comp, search.sug, filters.city]);

  const mediumOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of ranked) {
      const c = p.category ? normalizeCategory(p.category) : null;
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return FIELD_FILTER_OPTIONS.map((f) => ({
      id: f.id as string,
      label: f.label,
      count: counts.get(f.id as string) ?? 0,
    })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [ranked]);

  function setCity(next: { id?: string; name?: string }) {
    onPatch({ city: next.id, cityName: next.name });
  }

  const moreCount = (search.sug ? 1 : 0) + (comp !== "any" ? 1 : 0) + (search.topic ? 1 : 0);
  const anyActive =
    moreCount > 0 || format !== "any" || !!filters.city || filters.cat !== "all" || !!query.trim();

  const { user } = useAuth();
  const defaultCityQuery = useDefaultCity();
  const defaultCity = defaultCityQuery.data?.city ?? null;
  useApplyDefaultCity({
    feedKey: "collab",
    // Remote results are global: never narrow them to the visitor's city.
    isWorldwide: !remote && !filters.city && format === "any",
    apply: (city) => setCity({ id: city.id, name: city.name }),
    defaultCity,
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <YourGroupsStrip className="-mx-4 -mt-6 mb-6 rounded-none border-b md:-mx-6 md:-mt-8" />

      {/* Compact masthead */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-3xl text-ink md:text-4xl">{title}</h1>
          <p className="mt-1 text-sm text-ink-muted">{description}</p>
        </div>
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
      </div>

      {/* Sticky filter header */}
      <FilterHeader inset className="mt-4">
        <FilterSearch
          value={query}
          onChange={setQuery}
          label="Search Collabs"
          placeholder="Search briefs, roles, people…"
        />

        <FilterControls>
          <FilterSelect
            label="Filter by medium"
            width="min-w-[11rem]"
            value={filters.cat}
            onChange={(v) => onPatch({ cat: v })}
          >
            <option value="all">All mediums</option>
            {mediumOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} ({m.count})
              </option>
            ))}
          </FilterSelect>

          {format === "online" ? null : (
            <FilterCityPicker
              value={filters.city ?? ""}
              onChange={(id) =>
                setCity({
                  id: id || undefined,
                  name: cityOptions.find((c) => c.value === id)?.label,
                })
              }
              options={cityOptions}
            />
          )}

          <FilterToggleGroup<Format>
            value={format}
            onChange={onFormatChange}
            options={[
              { value: "any", label: "Any" },
              { value: "in_person", label: "In person" },
              { value: "online", label: "Remote" },
            ]}
          />

          <FilterMore activeCount={moreCount}>
            {topicOptions.length > 0 ? (
              <FilterMoreSection title="Topic">
                <FilterSelect
                  label="Filter by topic"
                  width="w-full"
                  value={search.topic}
                  onChange={(v) => onPatch({ topic: v })}
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

            <FilterMoreSection title="Compensation">
              <FilterSelect
                label="Filter by compensation"
                width="w-full"
                value={comp}
                onChange={(v) => onPatch({ comp: v })}
              >
                <option value="any">Any compensation</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid / credit</option>
              </FilterSelect>
            </FilterMoreSection>

            <FilterMoreSection title="Signals">
              <FilterMoreToggle active={search.sug} onClick={() => onPatch({ sug: !search.sug })}>
                Open to suggestions
              </FilterMoreToggle>
            </FilterMoreSection>
          </FilterMore>

          {anyActive ? (
            <FilterClear
              onClick={() => {
                setQuery("");
                onClear();
              }}
            />
          ) : null}
        </FilterControls>
      </FilterHeader>

      <FilterMeta className="px-1">
        {isLoading
          ? "Loading Collabs…"
          : `${posts.length} open collab${posts.length === 1 ? "" : "s"}`}
        {format === "online" ? " · Remote only" : null}
        {!remote && defaultCity && filters.city === defaultCity.id && defaultCity.source === "ip" ? (
          <>
            {" · based on your location · "}
            <button
              type="button"
              onClick={() => setCity({ id: undefined, name: undefined })}
              className="underline underline-offset-2 hover:text-ink"
            >
              see worldwide
            </button>
          </>
        ) : null}
        {!remote && !filters.city && format !== "online" && defaultCity ? (
          <>
            {" · near you: "}
            <button
              type="button"
              onClick={() => setCity({ id: defaultCity.id, name: defaultCity.name })}
              className="text-ink underline underline-offset-2 hover:text-primary"
            >
              {defaultCity.name}
            </button>
          </>
        ) : null}
      </FilterMeta>
      <div className="mt-8">
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
        ) : posts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
            <h3 className="font-display text-2xl text-ink">
              {anyActive ? "Nothing open here yet." : "Nothing open right now."}
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
              <CollabCard
                key={p.id}
                post={p}
                groups={groupTagMap?.get(p.id)}
                myGroupIds={myGroupIds}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

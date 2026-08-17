import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GroupCard, type GroupCardData } from "@/components/group-card";
import type { KindTab } from "@/components/groups-kind-switcher";
import { useGroupMemberAvatars } from "@/hooks/use-group-member-avatars";
import { categoryLabel, normalizeCategory } from "@/lib/taxonomy";

export const SORT_VALUES = ["featured", "members", "content", "az"] as const;
export type GroupsSort = (typeof SORT_VALUES)[number];
export type GroupsTab = KindTab;

const KIND_LABELS: Record<GroupCardData["kind"], string> = {
  city: "City",
  genre: "Field",
  micro: "Micro",
  scene: "Scene",
};

const TITLE_BY_TAB: Record<GroupsTab, string> = {
  all: "All Groups",
  "for-you": "Your groups",
  genre: "Fields",
  scene: "Scenes",
  micro: "Micro Groups",
  city: "Cities",
};

const PAGE_SIZE = 24;

const catLabel = (id: string) => (id === "all" ? "All categories" : categoryLabel(id));

/**
 * Every public Group, fetched once and shared by both the member and public
 * Groups surfaces (same query key → one network request per session).
 */
export function useAllPublicGroups() {
  return useQuery({
    queryKey: ["groups", "all"],
    staleTime: 60_000,
    queryFn: async (): Promise<GroupCardData[]> => {
      const { data } = await supabase
        .from("groups")
        .select(
          "id,slug,name,tagline,kind,cover_url,avatar_url,accent_color,member_count,workshop_count,collab_count,work_count,is_official,featured_at,category,city_id",
        )
        .is("deleted_at", null)
        .eq("visibility", "public")
        .order("featured_at", { ascending: false, nullsFirst: false })
        .order("member_count", { ascending: false })
        .limit(200);
      return (data ?? []) as unknown as GroupCardData[];
    },
  });
}

export function matchesGroupSearch(group: GroupCardData, needle: string): boolean {
  if (!needle) return true;
  const label = group.category ? categoryLabel(group.category) : "";
  const hay = [group.name, group.tagline ?? "", KIND_LABELS[group.kind], label]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
  return hay.includes(needle);
}

export function sortGroups(rows: GroupCardData[], sort: GroupsSort): GroupCardData[] {
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

export type DirectoryState = {
  tab: GroupsTab;
  query: string;
  /** City group name, e.g. "Chicago". Independent of `query`. */
  city: string;
  category: string;
  sort: GroupsSort;
};

/** Groups tied to a city: the city group itself, anything sharing its city_id,
 *  and scenes whose name/tagline names the city. */
export function matchesCity(
  group: GroupCardData,
  cityGroup: GroupCardData | undefined,
  cityName: string,
): boolean {
  if (!cityName) return true;
  if (cityGroup) {
    if (group.id === cityGroup.id) return true;
    if (cityGroup.city_id && group.city_id === cityGroup.city_id) return true;
  }
  const needle = cityName.toLocaleLowerCase();
  return `${group.name} ${group.tagline ?? ""}`.toLocaleLowerCase().includes(needle);
}

type Props = {
  state: DirectoryState;
  onChange: (patch: Partial<DirectoryState>) => void;
  onReset: () => void;
  authenticated: boolean;
  myIds: Set<string>;
};

/**
 * The Groups results grid: a one-line result summary, cards and progressive
 * Show More. Kind / search / city / medium / sort all live in the sticky
 * control row above.
 */
export function GroupsDirectory({ state, onChange, onReset, authenticated, myIds }: Props) {

  const { tab, query, sort, city } = state;
  const category = state.category === "all" ? "all" : normalizeCategory(state.category);
  const { data: allGroups = [], isLoading } = useAllPublicGroups();

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const cityName = city.trim();
    const cityGroup = cityName
      ? allGroups.find(
          (g) => g.kind === "city" && g.name.toLocaleLowerCase() === cityName.toLocaleLowerCase(),
        )
      : undefined;
    let rows = allGroups;
    if (tab === "for-you") {
      rows = rows.filter((g) => myIds.has(g.id));
    } else if (tab !== "all") {
      rows = rows.filter((g) => g.kind === tab);
    }
    if (cityName) rows = rows.filter((g) => matchesCity(g, cityGroup, cityName));
    if (category !== "all") {
      rows = rows.filter((g) => !!g.category && normalizeCategory(g.category) === category);
    }
    if (q) rows = rows.filter((g) => matchesGroupSearch(g, q));
    return sortGroups(rows, sort);
  }, [allGroups, tab, query, city, category, sort, myIds]);

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [tab, query, city, category, sort]);
  const visibleRows = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const avatarIds = useMemo(() => visibleRows.slice(0, 32).map((g) => g.id), [visibleRows]);
  const { data: avatarMap } = useGroupMemberAvatars(avatarIds);

  const resultsTitle = query.trim() ? "Search results" : TITLE_BY_TAB[tab];

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg text-ink md:text-xl">{resultsTitle}</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            {isLoading
              ? "Loading…"
              : `${filtered.length.toLocaleString()} ${filtered.length === 1 ? "scene" : "scenes"}`}
            {city.trim() ? ` · ${city.trim()}` : ""}
            {category !== "all" ? ` · ${catLabel(category)}` : ""}
            {query.trim() ? ` · “${query.trim()}”` : ""}
          </p>
        </div>
      </div>




      <div className="mt-5">
        {tab === "for-you" && !authenticated ? (
          <GroupsEmptyState
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
                onClick={() => onChange({ tab: "all" })}
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
            <GroupsEmptyState
              title="No Groups match that search."
              body="Try a different word — a city, scene, medium, or language."
              primary={
                <button
                  type="button"
                  onClick={() => onChange({ query: "" })}
                  className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-background"
                >
                  Clear search
                </button>
              }
            />
          ) : tab === "for-you" ? (
            <GroupsEmptyState
              title="You haven't joined any Groups yet."
              body="Browse the communities where your work, interests, and city belong."
              primary={
                <button
                  type="button"
                  onClick={() => onChange({ tab: "all" })}
                  className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-background"
                >
                  Explore Groups
                </button>
              }
            />
          ) : (
            <GroupsEmptyState
              title={`No ${TITLE_BY_TAB[tab].toLowerCase()} match those filters.`}
              body="Adjust the category or sort to see more."
              primary={
                <button
                  type="button"
                  onClick={onReset}
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
                  joined={myIds.has(g.id)}
                  avatars={avatarMap?.get(g.id)}
                />
              ))}
            </div>
            <ShowMore
              total={filtered.length}
              visible={visibleRows.length}
              onMore={() => setVisibleCount((n) => Math.min(n + PAGE_SIZE, filtered.length))}
            />
          </>
        )}
      </div>

      {!isLoading && filtered.length > 0 && (
        <div className="mt-10 rounded-xl border border-dashed border-border bg-surface p-6 text-center md:p-8">
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
  );
}

export function GroupsEmptyState({
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
    <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center md:p-12">
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
          {remaining >= PAGE_SIZE ? `Show ${PAGE_SIZE} more` : `Show remaining ${remaining}`}
        </button>
      ) : (
        <p className="text-xs text-ink-muted/80">That's every group.</p>
      )}
    </div>
  );
}

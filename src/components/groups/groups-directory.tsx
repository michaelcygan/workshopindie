import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GroupCard, type GroupCardData } from "@/components/group-card";
import { GroupsKindSwitcher, type KindTab } from "@/components/groups-kind-switcher";
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
import { categoryLabel, normalizeCategory } from "@/lib/taxonomy";

export const SORT_VALUES = ["featured", "members", "content", "az"] as const;
export type GroupsSort = (typeof SORT_VALUES)[number];
export type GroupsTab = KindTab;

const SORT_LABELS: Record<GroupsSort, string> = {
  featured: "Featured",
  members: "Most members",
  content: "Most content",
  az: "A–Z",
};

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
  category: string;
  sort: GroupsSort;
};

type Props = {
  state: DirectoryState;
  onChange: (patch: Partial<DirectoryState>) => void;
  onReset: () => void;
  authenticated: boolean;
  myIds: Set<string>;
  /** Section eyebrow + heading, rendered above the controls. */
  eyebrow?: string;
  heading?: string;
  intro?: string;
};

/**
 * The full Groups directory: search, kind switcher, category + sort, card
 * grid and progressive Show More. Shared by the member and public surfaces;
 * all state is URL-backed and owned by the route.
 */
export function GroupsDirectory({
  state,
  onChange,
  onReset,
  authenticated,
  myIds,
  eyebrow = "Explore",
  heading = "All Groups",
  intro,
}: Props) {
  const { tab, query, sort } = state;
  const category = state.category === "all" ? "all" : normalizeCategory(state.category);
  const { data: allGroups = [], isLoading } = useAllPublicGroups();

  const kindCounts = useMemo(
    () => ({
      all: allGroups.length,
      "for-you": allGroups.filter((g) => myIds.has(g.id)).length,
      genre: allGroups.filter((g) => g.kind === "genre").length,
      scene: allGroups.filter((g) => g.kind === "scene").length,
      micro: allGroups.filter((g) => g.kind === "micro").length,
      city: allGroups.filter((g) => g.kind === "city").length,
    }),
    [allGroups, myIds],
  ) satisfies Record<GroupsTab, number>;

  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of allGroups) {
      if (!g.category) continue;
      const c = normalizeCategory(g.category);
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    const present = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || catLabel(a[0]).localeCompare(catLabel(b[0])))
      .map(([id, count]) => ({ id, count }));
    return [{ id: "all", count: allGroups.length }, ...present];
  }, [allGroups]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    let rows = allGroups;
    if (tab === "for-you") {
      rows = rows.filter((g) => myIds.has(g.id));
    } else if (tab !== "all") {
      rows = rows.filter((g) => g.kind === tab);
    }
    if (category !== "all") {
      rows = rows.filter((g) => !!g.category && normalizeCategory(g.category) === category);
    }
    if (q) rows = rows.filter((g) => matchesGroupSearch(g, q));
    return sortGroups(rows, sort);
  }, [allGroups, tab, query, category, sort, myIds]);

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [tab, query, category, sort]);
  const visibleRows = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const avatarIds = useMemo(() => visibleRows.slice(0, 32).map((g) => g.id), [visibleRows]);
  const { data: avatarMap } = useGroupMemberAvatars(avatarIds);

  const filtersActive =
    tab !== "all" || category !== "all" || sort !== "featured" || !!query.trim();
  const resultsTitle = query.trim() ? "Search results" : TITLE_BY_TAB[tab];

  return (
    <section className="border-t border-border pt-8 md:pt-10">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
        {eyebrow}
      </p>
      <h2 className="mt-1 font-display text-[24px] text-ink md:text-[30px]">{heading}</h2>
      {intro && <p className="mt-2 max-w-2xl text-sm text-ink-muted">{intro}</p>}

      {/* Search */}
      <label className="mt-5 flex h-12 items-center gap-2 rounded-full border border-border bg-surface px-4">
        <Search className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
        <span className="sr-only">Search groups</span>
        <input
          value={query}
          onChange={(e) => onChange({ query: e.target.value })}
          placeholder="Search groups, cities, scenes, or languages…"
          aria-label="Search groups"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-muted/70 focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => onChange({ query: "" })}
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
          authenticated={authenticated}
          onChange={(t) => onChange({ tab: t })}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg text-ink md:text-xl">{resultsTitle}</h3>
          <p className="mt-0.5 text-sm text-ink-muted">
            {isLoading
              ? "Loading…"
              : `${filtered.length.toLocaleString()} ${filtered.length === 1 ? "result" : "results"}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tab !== "city" && (
            <div className="flex items-center gap-1.5">
              <span className="sr-only" id="category-label">
                Category
              </span>
              <Select value={category} onValueChange={(v) => onChange({ category: v })}>
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
                  {categoryOptions.map(({ id, count }) => (
                    <SelectItem key={id} value={id}>
                      {catLabel(id)} ({count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="sr-only" id="sort-label">
              Sort
            </span>
            <Select value={sort} onValueChange={(v) => onChange({ sort: v as GroupsSort })}>
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
              onClick={onReset}
            >
              Clear filters
            </Button>
          )}
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

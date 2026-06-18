import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef } from "react";
import { Search } from "lucide-react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { GroupCard, type GroupCardData } from "@/components/group-card";
import { cn } from "@/lib/utils";
import { PageHeaderCompact } from "@/components/page-header-compact";
import { KickerChip } from "@/components/kicker-chip";
import { RecapChip } from "@/components/recap-chip";
import { EmptySpark } from "@/components/empty-spark";
import { GroupsTrendingList } from "@/components/groups-trending-list";
import { GroupsBrowseByKind } from "@/components/groups-browse-by-kind";
import { useGroupMemberAvatars } from "@/hooks/use-group-member-avatars";
import { SceneTicker } from "@/components/scene-ticker";
import { FeaturedEventsCompact } from "@/components/featured-events-compact";
import { GroupsJoinFeedCard } from "@/components/groups-join-feed-card";

const TAB_VALUES = ["for-you", "city", "genre", "micro", "scene", "all"] as const;
type Tab = (typeof TAB_VALUES)[number];

const searchSchema = z.object({
  t: fallback(z.enum(TAB_VALUES), "all").default("all"),
  q: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/groups/")({
  validateSearch: zodValidator(searchSchema),
  component: GroupsIndex,
  head: () => ({
    meta: [
      { title: "Groups — Workshop" },
      { name: "description", content: "Scenes, genres, cities, micro-sprints. Join the rooms your work belongs in." },
      { property: "og:title", content: "Groups — Workshop" },
      { property: "og:description", content: "Scenes, genres, cities, micro-sprints. Join the rooms your work belongs in." },
    ],
  }),
});

const TABS: { id: Tab; label: string }[] = [
  { id: "for-you", label: "For you" },
  { id: "all", label: "All" },
  { id: "genre", label: "Genres" },
  { id: "scene", label: "Scenes" },
  { id: "micro", label: "Micro" },
  { id: "city", label: "Cities" },
];

function GroupsIndex() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const tab: Tab = search.t;
  const query = search.q;
  const allGroupsRef = useRef<HTMLElement>(null);

  const setTab = (t: Tab) =>
    navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, t }), replace: true });
  const setQuery = (q: string) =>
    navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, q }), replace: true });

  const { data: allGroups = [], isLoading } = useQuery({
    queryKey: ["groups", "all"],
    queryFn: async (): Promise<GroupCardData[]> => {
      const { data } = await supabase
        .from("groups")
        .select(
          "id,slug,name,tagline,kind,cover_url,avatar_url,accent_color,member_count,workshop_count,collab_count,work_count,is_official,featured_at",
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = allGroups;
    if (tab === "for-you") {
      rows = rows.filter((g) => myIdSet.has(g.id));
    } else if (tab !== "all") {
      rows = rows.filter((g) => g.kind === tab);
    }
    if (q) {
      rows = rows.filter(
        (g) => g.name.toLowerCase().includes(q) || (g.tagline ?? "").toLowerCase().includes(q),
      );
    }
    return rows;
  }, [allGroups, tab, query, myIdSet]);

  const trending = useMemo(
    () =>
      [...allGroups]
        .sort((a, b) => b.member_count - a.member_count)
        .slice(0, 5),
    [allGroups],
  );



  const showClusters = (tab === "all" || tab === "for-you") && !query;

  // Batched avatar fetch for visible cards (capped to avoid huge query).
  const visibleIds = useMemo(
    () => filtered.slice(0, 32).map((g) => g.id),
    [filtered],
  );
  const { data: avatarMap } = useGroupMemberAvatars(visibleIds);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <PageHeaderCompact title="Groups" />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <KickerChip live={myIds.length > 0}>
          {myIds.length > 0 ? "Your scenes" : "Find your scene"}
        </KickerChip>
        <p className="text-sm text-ink-muted">
          Scenes, genres, cities, micro-sprints. Join the rooms your work belongs in.
        </p>
        <RecapChip count={allGroups.length} label="groups open" />
      </div>

      {/* Sticky filter strip — placed directly under header so Groups content lands above the fold. */}
      <div className="sticky top-0 z-30 -mx-4 mt-5 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition",
                  tab === t.id
                    ? "bg-ink text-background"
                    : "border border-border bg-surface text-ink-soft hover:bg-muted",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex h-10 flex-1 items-center gap-2 rounded-full border border-border bg-surface px-3.5 shadow-soft md:max-w-md md:self-auto">
            <Search className="h-4 w-4 text-ink-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search — Indie Filmmakers, Hyperpop, Hackathon…"
              className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-muted/70 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-xs text-ink-muted hover:text-ink"
                aria-label="Clear search"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Ambient scene ticker — drifts slowly, pauses on hover. */}
      {allGroups.length > 0 && (
        <div className="mt-4">
          <SceneTicker groups={trending.length > 0 ? trending : allGroups.slice(0, 12)} />
        </div>
      )}

      {/* Discovery band: balanced 12-col grid so both columns share the same
          vertical rhythm — no orphaned space on either side. */}
      {showClusters && (
        <div className="mt-4 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
          <div className="flex flex-col gap-6 lg:col-span-4">
            <FeaturedEventsCompact />
            {trending.length > 0 && (
              <GroupsTrendingList groups={trending} joinedIds={myIdSet} />
            )}
            <GroupsJoinFeedCard
              hasGroups={myIds.length > 0}
              onBrowseAll={() =>
                allGroupsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className="flex-1"
            />
          </div>
          <div className="lg:col-span-8">
            <GroupsBrowseByKind
              groups={allGroups}
              joinedIds={myIdSet}
              onJump={(k) => setTab(k)}
            />
          </div>
        </div>
      )}

      <section ref={allGroupsRef} className="mt-8 scroll-mt-24">

        {tab === "for-you" && !user ? (
          <div className="rounded-3xl border border-dashed border-border bg-surface p-12 text-center">
            <h3 className="font-display text-2xl text-ink">Sign in to see your Groups.</h3>
            <Link to="/login" className="mt-3 inline-block text-sm text-primary underline">
              Sign in
            </Link>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-56 animate-pulse rounded-3xl bg-surface-2" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptySpark
            title={
              query
                ? "No groups match that search."
                : tab === "for-you"
                  ? "You haven't joined any Groups yet."
                  : "No groups here yet."
            }
            body={
              tab === "for-you"
                ? "Browse the catalog and join the scenes your work belongs in."
                : "More launching soon — check back."
            }
            action={
              tab === "for-you" ? (
                <button
                  type="button"
                  onClick={() => setTab("all")}
                  className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-background"
                >
                  Browse all Groups
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1">
              <div className="min-w-0">
                <h2 className="font-display text-xl text-ink md:text-2xl">
                  {tab === "all" || tab === "for-you" ? "All groups" : TABS.find((t) => t.id === tab)?.label}
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  {tab === "for-you"
                    ? "The scenes you've joined — everything happening across them."
                    : tab === "all"
                      ? "Every scene, genre, city, and micro-sprint open right now."
                      : `All ${TABS.find((t) => t.id === tab)?.label.toLowerCase()} on Workshop.`}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-soft">
                  {filtered.length} {filtered.length === 1 ? "group" : "groups"}
                </span>
                <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-medium text-background">
                  {TABS.find((t) => t.id === tab)?.label}
                </span>
                {query && (
                  <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] text-ink-soft">
                    "{query}"
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((g) => (
                <GroupCard
                  key={g.id}
                  group={g}
                  joined={myIdSet.has(g.id)}
                  avatars={avatarMap?.get(g.id)}
                />
              ))}
            </div>
            <div className="mt-8 flex flex-col items-center gap-2 border-t border-border/60 pt-6 text-center">
              <p className="text-sm text-ink-muted">
                That's every group {query ? "matching your search" : tab === "for-you" ? "you're in" : "open right now"}.
              </p>
              <p className="text-xs text-ink-muted/80">
                Missing your scene?{" "}
                <Link to="/groups" className="text-ink underline-offset-2 hover:underline">
                  Suggest a group
                </Link>{" "}
                — we add new rooms weekly.
              </p>
            </div>
          </>

        )}
      </section>
    </main>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { GroupCard, type GroupCardData } from "@/components/group-card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/groups/")({
  component: GroupsIndex,
  head: () => ({
    meta: [
      { title: "Groups — Workshop" },
      { name: "description", content: "Scenes, genres, cities. Join the rooms your work belongs in." },
      { property: "og:title", content: "Groups — Workshop" },
      { property: "og:description", content: "Scenes, genres, cities. Join the rooms your work belongs in." },
    ],
  }),
});

type Tab = "for-you" | "city" | "genre" | "micro" | "scene" | "all";

const TABS: { id: Tab; label: string }[] = [
  { id: "for-you", label: "For you" },
  { id: "all", label: "All" },
  { id: "city", label: "Cities" },
  { id: "genre", label: "Genres" },
  { id: "micro", label: "Micro" },
  { id: "scene", label: "Scenes" },
];

function GroupsIndex() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>(user ? "for-you" : "all");
  const [query, setQuery] = useState("");

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

  const featured = useMemo(
    () => allGroups.filter((g) => g.featured_at).slice(0, 6),
    [allGroups],
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl text-ink md:text-5xl">Groups</h1>
        <p className="text-ink-muted">
          Scenes, genres, cities. Join the rooms your work belongs in.
        </p>
      </div>

      <div className="mt-6 flex h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 shadow-soft">
        <Search className="h-4 w-4 text-ink-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search groups"
          className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-muted/70 focus:outline-none"
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition",
              tab === t.id
                ? "bg-ink text-background"
                : "border border-border bg-surface text-ink-soft hover:bg-muted",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "all" && featured.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 px-1 font-display text-lg text-ink">Featured</h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {featured.map((g) => (
              <GroupCard key={g.id} group={g} joined={myIdSet.has(g.id)} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        {tab === "for-you" && !user ? (
          <div className="rounded-3xl border border-dashed border-border bg-surface p-12 text-center">
            <h3 className="font-display text-2xl text-ink">Sign in to see your Groups.</h3>
            <Link to="/login" className="mt-3 inline-block text-sm text-primary underline">
              Sign in
            </Link>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-56 animate-pulse rounded-3xl bg-surface-2" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-surface p-12 text-center">
            <h3 className="font-display text-2xl text-ink">
              {tab === "for-you" ? "You haven't joined any Groups yet." : "No groups here yet."}
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
              {tab === "for-you"
                ? "Browse the catalog and join the scenes your work belongs in."
                : "More launching soon — check back."}
            </p>
            {tab === "for-you" && (
              <button
                type="button"
                onClick={() => setTab("all")}
                className="mt-4 rounded-full bg-ink px-4 py-2 text-sm font-medium text-background"
              >
                Browse all Groups
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((g) => (
              <GroupCard key={g.id} group={g} joined={myIdSet.has(g.id)} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

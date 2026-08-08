import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  SORT_VALUES,
  type DirectoryState,
  type GroupsSort,
  type GroupsTab,
} from "@/components/groups/groups-directory";
import { MemberGroupsHome } from "@/components/groups/member-groups-home";
import { PublicGroupsHome } from "@/components/groups/public-groups-home";

const TAB_VALUES = ["for-you", "city", "genre", "micro", "scene", "all"] as const;

const searchSchema = z.object({
  t: fallback(z.enum(TAB_VALUES), "all").default("all"),
  q: fallback(z.string(), "").default(""),
  // Free string so any group_category value (and legacy aliases) resolves.
  c: fallback(z.string(), "all").default("all"),
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
        content: "Independent creative scenes, city by city. Find the people, places, and movements your work belongs with.",
      },
      { property: "og:title", content: "Groups — Workshop" },
      {
        property: "og:description",
        content: "Independent creative scenes, city by city. Find the people, places, and movements your work belongs with.",
      },
      { property: "og:url", content: "https://workshopindie.com/groups" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Groups — Workshop" },
      {
        name: "twitter:description",
        content: "Independent creative scenes, city by city. Find the people, places, and movements your work belongs with.",
      },
    ],
    links: [{ rel: "canonical", href: "https://workshopindie.com/groups" }],
  }),
});

function GroupsIndex() {
  const { user, loading } = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const state: DirectoryState = useMemo(
    () => ({
      tab: search.t as GroupsTab,
      query: search.q,
      category: search.c,
      sort: search.s as GroupsSort,
    }),
    [search.t, search.q, search.c, search.s],
  );

  const onChange = (patch: Partial<DirectoryState>) =>
    navigate({
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        ...(patch.tab !== undefined ? { t: patch.tab } : {}),
        ...(patch.query !== undefined ? { q: patch.query } : {}),
        ...(patch.category !== undefined ? { c: patch.category } : {}),
        ...(patch.sort !== undefined ? { s: patch.sort } : {}),
      }),
      replace: true,
    });

  const onReset = () =>
    navigate({ search: () => ({ t: "all", q: "", c: "all", s: "featured" }), replace: true });

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

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="h-10 w-56 animate-pulse rounded-full bg-surface-2" />
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </div>
      </main>
    );
  }

  return user ? (
    <MemberGroupsHome state={state} onChange={onChange} onReset={onReset} myIds={myIdSet} />
  ) : (
    <PublicGroupsHome state={state} onChange={onChange} onReset={onReset} />
  );
}

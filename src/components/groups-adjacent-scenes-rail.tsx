import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { GroupCardCompact } from "@/components/group-card-compact";
import type { GroupCardData } from "@/components/group-card";
import { RecapChip } from "@/components/recap-chip";

async function fetchAdjacent(userId: string): Promise<GroupCardData[]> {
  const { data: mine } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId);
  const myGroupIds = new Set((mine ?? []).map((r) => r.group_id as string));
  if (myGroupIds.size === 0) return [];

  const { data: cohort } = await supabase
    .from("group_members")
    .select("user_id")
    .in("group_id", [...myGroupIds])
    .neq("user_id", userId)
    .limit(500);
  const otherUsers = [...new Set((cohort ?? []).map((r) => r.user_id as string))];
  if (otherUsers.length === 0) return [];

  const { data: theirGroups } = await supabase
    .from("group_members")
    .select("group_id")
    .in("user_id", otherUsers)
    .limit(1500);

  const counts = new Map<string, number>();
  for (const row of theirGroups ?? []) {
    const gid = row.group_id as string;
    if (myGroupIds.has(gid)) continue;
    counts.set(gid, (counts.get(gid) ?? 0) + 1);
  }
  const topIds = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([id]) => id);
  if (topIds.length === 0) return [];

  const { data: groups } = await supabase
    .from("groups")
    .select(
      "id,slug,name,tagline,kind,cover_url,avatar_url,accent_color,member_count,workshop_count,collab_count,work_count,is_official,featured_at,category",
    )
    .in("id", topIds)
    .is("deleted_at", null)
    .eq("visibility", "public");

  const byId = new Map((groups ?? []).map((g) => [g.id as string, g]));
  return topIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .slice(0, 8) as unknown as GroupCardData[];
}

export function GroupsAdjacentScenesRail() {
  const { user } = useAuth();
  const { data = [], isLoading } = useQuery({
    queryKey: ["groups-adjacent-scenes", user?.id ?? "anon"],
    enabled: !!user,
    queryFn: () => fetchAdjacent(user!.id),
    staleTime: 5 * 60_000,
  });

  if (!user || isLoading || data.length === 0) return null;

  return (
    <section className="mt-8" aria-label="Adjacent scenes for you">
      <div className="mb-3 flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-xl text-ink md:text-2xl">Adjacent scenes for you</h2>
          <RecapChip count={data.length} label="related" />
        </div>
        <span className="text-xs text-ink-muted">Members of your Groups also joined</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.map((g) => (
          <GroupCardCompact key={g.id} group={g} />
        ))}
      </div>
    </section>
  );
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AdjacentGroup = {
  id: string;
  slug: string;
  name: string;
  avatar_url: string | null;
  member_count: number | null;
};

async function fetchAdjacentForGroup(groupId: string): Promise<AdjacentGroup[]> {
  const { data: members } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .limit(500);
  const userIds = [...new Set((members ?? []).map((r) => r.user_id as string))];
  if (userIds.length === 0) return [];

  const { data: theirGroups } = await supabase
    .from("group_members")
    .select("group_id")
    .in("user_id", userIds)
    .limit(1500);

  const counts = new Map<string, number>();
  for (const row of theirGroups ?? []) {
    const gid = row.group_id as string;
    if (gid === groupId) continue;
    counts.set(gid, (counts.get(gid) ?? 0) + 1);
  }
  const topIds = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id]) => id);
  if (topIds.length === 0) return [];

  const { data: groups } = await supabase
    .from("groups")
    .select("id,slug,name,avatar_url,member_count")
    .in("id", topIds)
    .is("deleted_at", null)
    .eq("visibility", "public");

  const byId = new Map(
    (groups ?? []).map((g) => [g.id as string, g as unknown as AdjacentGroup]),
  );
  return topIds.map((id) => byId.get(id)).filter(Boolean) as AdjacentGroup[];
}

export function useAdjacentGroups(groupId: string | undefined) {
  return useQuery({
    queryKey: ["group-adjacent", groupId],
    queryFn: () => fetchAdjacentForGroup(groupId as string),
    enabled: !!groupId,
    staleTime: 5 * 60 * 1000,
  });
}

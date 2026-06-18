import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GroupCardCompact } from "@/components/group-card-compact";
import type { GroupCardData } from "@/components/group-card";

type Props = { groupId: string; className?: string };

/** Other groups that members of this group also joined. */
export function AdjacentGroupsRail({ groupId, className }: Props) {
  const { data } = useQuery({
    queryKey: ["group", groupId, "adjacent"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<GroupCardData[]> => {
      // Members of this group
      const { data: members } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId)
        .limit(200);
      const memberIds = (members ?? []).map((m) => m.user_id as string);
      if (memberIds.length === 0) return [];

      // Other group ids those members belong to
      const { data: others } = await supabase
        .from("group_members")
        .select("group_id")
        .in("user_id", memberIds)
        .neq("group_id", groupId)
        .limit(500);
      const counts = new Map<string, number>();
      for (const row of others ?? []) {
        const id = row.group_id as string;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      const topIds = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([id]) => id);
      if (topIds.length === 0) return [];

      const { data: groups } = await supabase
        .from("groups")
        .select(
          "id,slug,name,tagline,kind,cover_url,avatar_url,accent_color,member_count,workshop_count,collab_count,work_count,is_official,featured_at",
        )
        .in("id", topIds)
        .is("deleted_at", null)
        .eq("visibility", "public");
      const byId = new Map((groups ?? []).map((g) => [g.id as string, g]));
      return topIds
        .map((id) => byId.get(id))
        .filter(Boolean) as unknown as GroupCardData[];
    },
  });
  if (!data || data.length === 0) return null;
  return (
    <section className={className}>
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h2 className="font-display text-xl text-ink md:text-2xl">Adjacent scenes</h2>
        <span className="text-xs text-ink-muted">Members of this group also joined</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.map((g) => (
          <GroupCardCompact key={g.id} group={g} />
        ))}
      </div>
    </section>
  );
}

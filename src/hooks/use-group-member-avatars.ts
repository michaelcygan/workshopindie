import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  group_id: string;
  user: { avatar_url: string | null; hide_group_memberships: boolean | null } | null;
};

/**
 * Batched fetch of up to 3 member avatars per group id.
 * Returns a Map<groupId, avatarUrls[]>. Cached 60s.
 */
export function useGroupMemberAvatars(groupIds: string[]) {
  const key = [...groupIds].sort().join(",");
  return useQuery({
    queryKey: ["group-member-avatars", key],
    enabled: groupIds.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Map<string, string[]>> => {
      const { data } = await supabase
        .from("group_members")
        .select(
          "group_id,user:profiles!group_members_user_id_fkey(avatar_url,hide_group_memberships)",
        )
        .in("group_id", groupIds)
        .limit(Math.min(groupIds.length * 16, 800));
      const map = new Map<string, string[]>();
      for (const row of (data ?? []) as unknown as Row[]) {
        if (!row.user || row.user.hide_group_memberships) continue;
        const url = row.user.avatar_url;
        if (!url) continue;
        const list = map.get(row.group_id) ?? [];
        if (list.length < 3) {
          list.push(url);
          map.set(row.group_id, list);
        }
      }
      return map;
    },
  });
}

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export type MyGroup = {
  id: string;
  slug: string;
  name: string;
  kind: "city" | "genre" | "micro" | "scene";
  member_count: number;
};

/** Returns the groups the current viewer has joined. Cached per user. */
export function useMyGroups() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-groups", user?.id ?? null],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<MyGroup[]> => {
      const { data, error } = await supabase
        .from("group_members")
        .select("group:groups(id,slug,name,kind,member_count,deleted_at)")
        .eq("user_id", user!.id);
      if (error) throw error;
      const rows = (data ?? []) as Array<{
        group: {
          id: string;
          slug: string;
          name: string;
          kind: MyGroup["kind"];
          member_count: number;
          deleted_at: string | null;
        } | null;
      }>;
      return rows
        .map((r) => r.group)
        .filter((g): g is NonNullable<typeof g> => !!g && !g.deleted_at)
        .map(({ id, slug, name, kind, member_count }) => ({ id, slug, name, kind, member_count }));
    },
  });
}

/** Returns a set of group ids the current user belongs to. */
export function useMyGroupIdSet() {
  const { data } = useMyGroups();
  return new Set((data ?? []).map((g) => g.id));
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/**
 * Returns the set of user IDs the current viewer should not see content from:
 * users they've blocked + users who blocked them.
 *
 * Used to filter feeds (works, collabs, network) client-side. RLS already
 * blocks the underlying interactions (DMs, follows, applications, comments).
 */
export function useBlockedIds(): { ids: Set<string>; isLoading: boolean } {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["blocked-ids", user?.id],
    queryFn: async () => {
      if (!user) return [] as string[];
      const [{ data: out }, { data: inb }] = await Promise.all([
        supabase.from("user_blocks").select("blocked_user_id").eq("blocker_user_id", user.id),
        supabase.from("user_blocks").select("blocker_user_id").eq("blocked_user_id", user.id),
      ]);
      const ids = new Set<string>();
      (out ?? []).forEach((r) => ids.add(r.blocked_user_id));
      (inb ?? []).forEach((r) => ids.add(r.blocker_user_id));
      return Array.from(ids);
    },
    enabled: !!user,
    staleTime: 60_000,
  });
  return { ids: new Set(data ?? []), isLoading };
}

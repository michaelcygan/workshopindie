import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LoungePosts } from "@/components/lounge-posts";

/**
 * Group Posts tab — surfaces published blog posts authored by anyone who is a
 * member of this group. Reuses the Lounge Posts component so the chip filter
 * + peek-open behavior stays consistent.
 */
export function GroupPostsTab({ group }: { group: { id: string } }) {
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["group", group.id, "posts-members"],
    queryFn: async () => {
      const { data: gm } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", group.id)
        .limit(500);
      const ids = (gm ?? []).map((r) => r.user_id as string);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url")
        .in("id", ids);
      return (profs ?? []).map((p) => ({
        user_id: p.id as string,
        display_name: p.display_name as string | null,
        username: p.username as string | null,
        avatar_url: p.avatar_url as string | null,
      }));
    },
  });

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-surface-2" />;
  }

  return (
    <div className="rounded-2xl border border-border bg-surface">
      <LoungePosts participants={members} className="min-h-[420px]" />
    </div>
  );
}

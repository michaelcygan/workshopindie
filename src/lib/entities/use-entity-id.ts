/**
 * Lazy slug → id resolvers shared by every surface that opens a peek from a
 * reference (inline chips, editorial links). The lookup only runs when a peek
 * actually opens, so a page full of references costs nothing until used.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useEntityIdBySlug(
  table: "works" | "collab_posts",
  slug: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [table === "works" ? "work-id-by-slug" : "collab-id-by-slug", slug],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from(table).select("id").eq("slug", slug).maybeSingle();
      return (data?.id as string | undefined) ?? null;
    },
  });
}

export function useProfileIdByUsername(username: string, enabled: boolean) {
  return useQuery({
    queryKey: ["profile-id-by-username", username.toLowerCase()],
    enabled: enabled && !!username,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", username)
        .maybeSingle();
      return (data?.id as string | undefined) ?? null;
    },
  });
}

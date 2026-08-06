import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  addInfluence,
  removeInfluence,
  reorderInfluences,
  resolveInfluenceUrl,
  updateInfluence,
} from "@/lib/influences.functions";
import type { Influence } from "@/lib/influences/types";

const SELECT =
  "id,position,source_kind,work_id,external_url,title,creator_name,category,thumbnail_url,provider,work:works(id,slug,title,cover_url,category,status,visibility)";

export function influencesQueryKey(profileId: string | undefined) {
  return ["profile-influences", profileId ?? "none"] as const;
}

/** One query for a profile's whole influence shelf, with live Work data joined. */
export function useInfluences(profileId: string | undefined) {
  return useQuery({
    queryKey: influencesQueryKey(profileId),
    enabled: !!profileId,
    staleTime: 30_000,
    queryFn: async (): Promise<Influence[]> => {
      const { data, error } = await supabase
        .from("profile_influences")
        .select(SELECT)
        .eq("profile_id", profileId!)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => {
        const w = (row as { work?: { status?: string; visibility?: string } | null }).work ?? null;
        const visible =
          w && w.status === "published" && ["public", "unlisted"].includes(w.visibility ?? "");
        return {
          ...(row as unknown as Influence),
          work: visible ? ((row as unknown as Influence).work ?? null) : null,
        };
      });
    },
  });
}

/** Owner-side mutations. Each persists on its own — no global Save required. */
export function useInfluenceMutations(profileId: string | undefined) {
  const qc = useQueryClient();
  const key = influencesQueryKey(profileId);
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["profile-influence-count", profileId] });
  };

  const add = useServerFn(addInfluence);
  const update = useServerFn(updateInfluence);
  const remove = useServerFn(removeInfluence);
  const reorder = useServerFn(reorderInfluences);
  const resolve = useServerFn(resolveInfluenceUrl);

  return {
    resolveUrl: useMutation({ mutationFn: (url: string) => resolve({ data: { url } }) }),
    add: useMutation({
      mutationFn: (input: Parameters<typeof addInfluence>[0]["data"]) => add({ data: input }),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: (input: Parameters<typeof updateInfluence>[0]["data"]) => update({ data: input }),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => remove({ data: { id } }),
      onSuccess: invalidate,
    }),
    reorder: useMutation({
      mutationFn: (ids: string[]) => reorder({ data: { ids } }),
      onSuccess: invalidate,
    }),
  };
}

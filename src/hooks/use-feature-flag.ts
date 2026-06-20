import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function hashUserBucket(userId: string | null | undefined, key: string): number {
  const s = `${userId ?? ""}:${key}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 100;
}

export function useFeatureFlag(key: string, userId?: string | null): boolean {
  const { data } = useQuery({
    queryKey: ["feature_flag", key],
    queryFn: async () => {
      const { data } = await supabase.from("feature_flags").select("enabled,rollout_pct").eq("key", key).maybeSingle();
      return data;
    },
    staleTime: 60_000,
  });
  if (!data?.enabled) return false;
  if ((data.rollout_pct ?? 0) >= 100) return true;
  return hashUserBucket(userId ?? null, key) < (data.rollout_pct ?? 0);
}

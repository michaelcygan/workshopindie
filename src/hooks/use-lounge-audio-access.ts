/**
 * Cache the caller's Lounge-audio monthly quota. Refetches every 60s so the
 * UI reflects newly-consumed minutes without waiting for a full page reload.
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { getLoungeAudioAccess } from "@/lib/lounge-access.functions";
import type { LoungeAudioAccess } from "@/lib/lounge-access.server";

export function useLoungeAudioAccess() {
  const { user } = useAuth();
  return useQuery<LoungeAudioAccess>({
    queryKey: ["lounge-audio-access", user?.id],
    enabled: !!user,
    refetchInterval: 60_000,
    queryFn: async () => getLoungeAudioAccess(),
  });
}

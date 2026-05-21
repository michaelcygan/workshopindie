import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";

export const FREE_PORTFOLIO_CAP = 10;
export const FREE_OPEN_COLLAB_CAP = 2;
export const FREE_LOUNGE_MINUTES_PER_DAY = 60;

export type PlusState = {
  isPlus: boolean;
  loading: boolean;
  subscription: {
    status: string | null;
    tier: "free" | "plus";
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    stripe_customer_id: string | null;
  } | null;
};

export function usePlus(): PlusState {
  const { user, loading: authLoading } = useAuth();
  const env = getStripeEnvironment();

  const { data, isLoading } = useQuery({
    queryKey: ["subscription", user?.id, env],
    enabled: !!user,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("status,tier,current_period_end,cancel_at_period_end,stripe_customer_id")
        .eq("user_id", user!.id)
        .eq("environment", env)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const sub = data ?? null;
  const isPlus =
    !!sub &&
    sub.tier === "plus" &&
    (sub.status === "active" || sub.status === "trialing") &&
    (!sub.current_period_end || new Date(sub.current_period_end as string) > new Date());

  return {
    isPlus,
    loading: authLoading || (!!user && isLoading),
    subscription: sub as PlusState["subscription"],
  };
}

export function useLoungeMinutesToday(): { minutes: number; loading: boolean } {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["lounge-minutes-today", user?.id],
    enabled: !!user,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("lounge_minutes_today", {
        _user_id: user!.id,
      });
      if (error) return 0;
      return data ?? 0;
    },
  });
  return { minutes: data ?? 0, loading: isLoading };
}

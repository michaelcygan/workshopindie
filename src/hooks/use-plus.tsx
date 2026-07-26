import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import {
  FREE_OPEN_COLLAB_CAP,
  FREE_PUBLISHED_WORK_CAP,
  FREE_BLOG_PUBLICATIONS_PER_MONTH,
  FREE_LOUNGE_MINUTES_PER_MONTH,
  resolveEntitlements,
  type WorkshopEntitlements,
} from "@/lib/entitlements";

// Re-export the central constants so existing importers of use-plus keep
// working. The entitlements module is the source of truth.
export {
  FREE_OPEN_COLLAB_CAP,
  FREE_PUBLISHED_WORK_CAP,
  FREE_BLOG_PUBLICATIONS_PER_MONTH,
  FREE_LOUNGE_MINUTES_PER_MONTH,
};
/** @deprecated Use FREE_PUBLISHED_WORK_CAP. */
export const FREE_PORTFOLIO_CAP = FREE_PUBLISHED_WORK_CAP;

export type PlusState = {
  isPlus: boolean;
  loading: boolean;
  entitlements: WorkshopEntitlements;
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
  const entitlements = resolveEntitlements(sub);
  const isPlus = entitlements.tier === "plus";

  return {
    isPlus,
    loading: authLoading || (!!user && isLoading),
    entitlements,
    subscription: sub as PlusState["subscription"],
  };
}

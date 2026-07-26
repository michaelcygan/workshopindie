import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getMyEffectivePlusAccess } from "@/lib/plus-access.functions";
import { FREE_EFFECTIVE_PLUS_ACCESS, type EffectivePlusAccess } from "@/lib/plus-access";
import {
  FREE_OPEN_COLLAB_CAP,
  FREE_PUBLISHED_WORK_CAP,
  FREE_BLOG_PUBLICATIONS_PER_MONTH,
  FREE_LOUNGE_MINUTES_PER_MONTH,
  resolveEntitlements,
  type WorkshopEntitlements,
} from "@/lib/entitlements";

export {
  FREE_OPEN_COLLAB_CAP,
  FREE_PUBLISHED_WORK_CAP,
  FREE_BLOG_PUBLICATIONS_PER_MONTH,
  FREE_LOUNGE_MINUTES_PER_MONTH,
};

export type PlusState = {
  isPlus: boolean;
  loading: boolean;
  entitlements: WorkshopEntitlements;
  /** Full effective-Plus state so UI can differentiate paid / trial /
   *  complimentary / lifetime without re-querying. */
  access: EffectivePlusAccess;
  /** Backward-compatible subset of the paid Stripe subscription for
   *  existing callers that only reach for renewal fields. Null when the
   *  user has no paid subscription (e.g. lifetime or complimentary-only). */
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
  const fetchAccess = useServerFn(getMyEffectivePlusAccess);

  const { data, isLoading } = useQuery({
    queryKey: ["plus-access", user?.id],
    enabled: !!user,
    refetchInterval: 60_000,
    queryFn: () => fetchAccess(),
  });

  const access = data ?? FREE_EFFECTIVE_PLUS_ACCESS;
  const entitlements = resolveEntitlements(access);

  const subscription = access.paidSubscription
    ? {
        status: access.paidSubscription.status,
        tier: access.tier,
        current_period_end: access.paidSubscription.currentPeriodEnd,
        cancel_at_period_end: access.paidSubscription.cancelAtPeriodEnd,
        stripe_customer_id: access.paidSubscription.stripeCustomerId,
      }
    : null;

  return {
    isPlus: access.isPlus,
    loading: authLoading || (!!user && isLoading),
    entitlements,
    access,
    subscription,
  };
}

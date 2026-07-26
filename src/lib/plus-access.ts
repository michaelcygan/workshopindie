/**
 * Shared shapes for the effective-Plus resolver.
 *
 * `EffectivePlusAccess` is the single authoritative answer to "does this user
 * currently have Plus, why, and until when?" — combining Stripe billing state
 * with complimentary and lifetime grants from `plus_access_grants`.
 *
 * The resolver itself lives in `plus-access.server.ts` (service role); the
 * client hits it through the `getMyEffectivePlusAccess` server function
 * declared in `plus-access.functions.ts`.
 */

export type PlusAccessSource =
  | "free"
  | "paid"
  | "stripe_trial"
  | "complimentary"
  | "lifetime";

export type EffectivePlusAccess = {
  isPlus: boolean;
  tier: "free" | "plus";
  source: PlusAccessSource;
  lifetime: boolean;
  accessStartsAt: string | null;
  accessEndsAt: string | null;

  paidSubscription: {
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
  } | null;

  activeGrant: {
    id: string;
    source: string;
    benefitType: "months" | "lifetime";
    accessEndsAt: string | null;
  } | null;
};

export const FREE_EFFECTIVE_PLUS_ACCESS: EffectivePlusAccess = {
  isPlus: false,
  tier: "free",
  source: "free",
  lifetime: false,
  accessStartsAt: null,
  accessEndsAt: null,
  paidSubscription: null,
  activeGrant: null,
};

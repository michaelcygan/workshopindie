/**
 * Authoritative effective-Plus resolver (service-role, server-only).
 *
 * Combines the Stripe-backed `subscriptions` row with the complimentary
 * `plus_access_grants` ledger and returns a single `EffectivePlusAccess`
 * describing the user's current tier, why they have it, and when it ends.
 *
 * Precedence (highest first):
 *   1. Lifetime grant  → source="lifetime",     ends=null
 *   2. Paid Stripe subscription (active/trialing/past_due within grace,
 *      or canceled but current_period_end still in the future)
 *                      → source="paid" | "stripe_trial"
 *   3. Timed complimentary grant that hasn't ended
 *                      → source="complimentary"
 *   4. Otherwise       → source="free"
 *
 * Grants are stacked at write time (see `applyComplimentaryPlusBenefit`);
 * this reader just picks the grant with the furthest access_ends_at.
 */
import type { EffectivePlusAccess } from "./plus-access";
import { FREE_EFFECTIVE_PLUS_ACCESS } from "./plus-access";

type SubRow = {
  status: string | null;
  tier: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

type GrantRow = {
  id: string;
  benefit_type: "months" | "lifetime";
  status: string;
  source: string;
  access_starts_at: string | null;
  access_ends_at: string | null;
};

function paidSubscriptionActive(sub: SubRow | null): boolean {
  if (!sub || sub.tier !== "plus") return false;
  const status = sub.status ?? "";
  const end = sub.current_period_end ? new Date(sub.current_period_end) : null;
  const endFuture = !end || end.getTime() > Date.now();
  if ((status === "active" || status === "trialing" || status === "past_due") && endFuture) return true;
  if (status === "canceled" && end && end.getTime() > Date.now()) return true;
  return false;
}

function pickActiveGrant(rows: GrantRow[]): GrantRow | null {
  const now = Date.now();
  const active = rows.filter((r) => {
    if (!(r.status === "active" || r.status === "applied_to_stripe")) return false;
    if (r.benefit_type === "lifetime") return true;
    if (!r.access_ends_at) return true;
    return new Date(r.access_ends_at).getTime() > now;
  });
  if (active.length === 0) return null;
  // Lifetime wins outright.
  const lifetime = active.find((r) => r.benefit_type === "lifetime");
  if (lifetime) return lifetime;
  // Otherwise pick the furthest-ending timed grant.
  return active.reduce((a, b) => {
    const ea = a.access_ends_at ? new Date(a.access_ends_at).getTime() : 0;
    const eb = b.access_ends_at ? new Date(b.access_ends_at).getTime() : 0;
    return eb > ea ? b : a;
  });
}

export async function resolveEffectivePlusAccess(
  userId: string,
): Promise<EffectivePlusAccess> {
  if (!userId) return FREE_EFFECTIVE_PLUS_ACCESS;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [subRes, grantsRes] = await Promise.all([
    supabaseAdmin
      .from("subscriptions")
      .select(
        "status,tier,current_period_end,cancel_at_period_end,stripe_customer_id,stripe_subscription_id",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("plus_access_grants")
      .select("id,benefit_type,status,source,access_starts_at,access_ends_at")
      .eq("user_id", userId)
      .in("status", ["active", "applied_to_stripe"]),
  ]);

  const sub = (subRes.data as SubRow | null) ?? null;
  const grants = ((grantsRes.data as GrantRow[] | null) ?? []).slice();
  const activeGrant = pickActiveGrant(grants);

  const paidSub = paidSubscriptionActive(sub)
    ? {
        status: sub!.status ?? "active",
        currentPeriodEnd: sub!.current_period_end,
        cancelAtPeriodEnd: !!sub!.cancel_at_period_end,
        stripeCustomerId: sub!.stripe_customer_id,
        stripeSubscriptionId: sub!.stripe_subscription_id,
      }
    : null;

  // 1. Lifetime beats everything.
  if (activeGrant && activeGrant.benefit_type === "lifetime") {
    return {
      isPlus: true,
      tier: "plus",
      source: "lifetime",
      lifetime: true,
      accessStartsAt: activeGrant.access_starts_at,
      accessEndsAt: null,
      paidSubscription: paidSub,
      activeGrant: {
        id: activeGrant.id,
        source: activeGrant.source,
        benefitType: "lifetime",
        accessEndsAt: null,
      },
    };
  }

  // 2. Paid Stripe subscription (or trial).
  if (paidSub) {
    return {
      isPlus: true,
      tier: "plus",
      source: paidSub.status === "trialing" ? "stripe_trial" : "paid",
      lifetime: false,
      accessStartsAt: null,
      accessEndsAt: paidSub.currentPeriodEnd,
      paidSubscription: paidSub,
      activeGrant: activeGrant
        ? {
            id: activeGrant.id,
            source: activeGrant.source,
            benefitType: activeGrant.benefit_type,
            accessEndsAt: activeGrant.access_ends_at,
          }
        : null,
    };
  }

  // 3. Timed complimentary grant.
  if (activeGrant) {
    return {
      isPlus: true,
      tier: "plus",
      source: "complimentary",
      lifetime: false,
      accessStartsAt: activeGrant.access_starts_at,
      accessEndsAt: activeGrant.access_ends_at,
      paidSubscription: null,
      activeGrant: {
        id: activeGrant.id,
        source: activeGrant.source,
        benefitType: activeGrant.benefit_type,
        accessEndsAt: activeGrant.access_ends_at,
      },
    };
  }

  return FREE_EFFECTIVE_PLUS_ACCESS;
}

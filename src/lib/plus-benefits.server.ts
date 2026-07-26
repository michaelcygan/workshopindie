/**
 * Single write-path for complimentary Workshop Plus benefits.
 *
 * Used by admin direct grants, offer redemptions, legacy comp code, and
 * (in the future) referral webhooks. Handles stacking math:
 *   1 month = 30 days.
 *   New timed grants start at max(now, latest active timed grant end).
 *   Lifetime grants ignore duration; there can be only one active per user
 *   (enforced by the plus_lifetime_single_active partial unique index).
 *
 * Server-only. Callers are responsible for authorization.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type PlusBenefitInput = {
  userId: string;
  source: "admin_direct" | "offer_link" | "legacy_comp" | "event_promo" | "referral" | "other";
  sourceId?: string | null;
  benefitType: "months" | "lifetime";
  durationMonths?: number | null;
  environment?: "sandbox" | "live";
  note?: string | null;
  grantedBy?: string | null;
};

export type PlusBenefitResult = {
  grantId: string;
  benefitType: "months" | "lifetime";
  accessStartsAt: string;
  accessEndsAt: string | null;
};

export async function applyComplimentaryPlusBenefit(
  input: PlusBenefitInput,
): Promise<PlusBenefitResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const env =
    input.environment ??
    (process.env.NODE_ENV === "production" ? "live" : "sandbox");

  if (input.benefitType === "lifetime") {
    // Reject if user already has an active lifetime grant.
    const { data: existing } = await supabaseAdmin
      .from("plus_access_grants")
      .select("id")
      .eq("user_id", input.userId)
      .eq("benefit_type", "lifetime")
      .in("status", ["active", "applied_to_stripe"])
      .maybeSingle();
    if (existing) throw new Error("User already has a lifetime Plus grant.");

    const startsAt = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("plus_access_grants")
      .insert({
        user_id: input.userId,
        environment: env,
        benefit_type: "lifetime",
        duration_months: null,
        status: "active",
        access_starts_at: startsAt,
        access_ends_at: null,
        source: input.source,
        source_id: input.sourceId ?? null,
        application_method: "lifetime_override",
        granted_by: input.grantedBy ?? null,
        note: input.note ?? null,
      } as never)
      .select("id, access_starts_at, access_ends_at")
      .single();
    if (error) throw new Error(error.message);
    return {
      grantId: (data as any).id,
      benefitType: "lifetime",
      accessStartsAt: (data as any).access_starts_at,
      accessEndsAt: null,
    };
  }

  const months = input.durationMonths ?? 0;
  if (!months || months < 1) throw new Error("durationMonths is required for month-based benefits.");

  // Stack after the furthest still-active timed grant's end.
  const { data: latest } = await supabaseAdmin
    .from("plus_access_grants")
    .select("access_ends_at")
    .eq("user_id", input.userId)
    .in("status", ["active", "applied_to_stripe"])
    .eq("benefit_type", "months")
    .not("access_ends_at", "is", null)
    .order("access_ends_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = Date.now();
  const latestEnd = (latest as any)?.access_ends_at
    ? new Date((latest as any).access_ends_at).getTime()
    : 0;
  const startsMs = Math.max(now, latestEnd);
  const endsMs = startsMs + months * 30 * MS_PER_DAY;
  const startsAt = new Date(startsMs).toISOString();
  const endsAt = new Date(endsMs).toISOString();

  const { data, error } = await supabaseAdmin
    .from("plus_access_grants")
    .insert({
      user_id: input.userId,
      environment: env,
      benefit_type: "months",
      duration_months: months,
      status: "active",
      access_starts_at: startsAt,
      access_ends_at: endsAt,
      source: input.source,
      source_id: input.sourceId ?? null,
      application_method: "local_entitlement",
      granted_by: input.grantedBy ?? null,
      note: input.note ?? null,
    } as never)
    .select("id, access_starts_at, access_ends_at")
    .single();
  if (error) throw new Error(error.message);

  return {
    grantId: (data as any).id,
    benefitType: "months",
    accessStartsAt: (data as any).access_starts_at,
    accessEndsAt: (data as any).access_ends_at,
  };
}

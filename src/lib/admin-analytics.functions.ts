import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Forbidden: admin only");
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const [kpi, signups, dau, surfaces] = await Promise.all([
      admin.from("vw_kpi_now").select("*").maybeSingle(),
      admin.from("vw_daily_signups").select("*"),
      admin.from("vw_dau_series").select("*"),
      admin.from("vw_engagement_by_surface_7d").select("*"),
    ]);
    return {
      kpi: kpi.data ?? null,
      signups: signups.data ?? [],
      dau: dau.data ?? [],
      surfaces: surfaces.data ?? [],
    };
  });

export const getAdminGrowth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const [funnel, cohorts, referrals, signups] = await Promise.all([
      admin.from("vw_acquisition_funnel").select("*").maybeSingle(),
      admin.from("vw_signup_cohort_retention").select("*"),
      admin.from("vw_referral_leaderboard").select("*"),
      admin.from("vw_daily_signups").select("*"),
    ]);
    return {
      funnel: funnel.data ?? null,
      cohorts: cohorts.data ?? [],
      referrals: referrals.data ?? [],
      signups: signups.data ?? [],
    };
  });

export const getAdminEngagement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const [surfaces, dau, kpi] = await Promise.all([
      admin.from("vw_engagement_by_surface_7d").select("*"),
      admin.from("vw_dau_series").select("*"),
      admin.from("vw_kpi_now").select("dau,wau,mau").maybeSingle(),
    ]);
    return {
      surfaces: surfaces.data ?? [],
      dau: dau.data ?? [],
      kpi: kpi.data ?? null,
    };
  });

export const getAdminMarketplace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const [collabFunnel, workshopFunnel, worksFunnel, health] = await Promise.all([
      admin.from("vw_collab_funnel").select("*").maybeSingle(),
      admin.from("vw_workshop_funnel").select("*").maybeSingle(),
      admin.from("vw_works_funnel").select("*").maybeSingle(),
      admin.from("vw_marketplace_health").select("*").maybeSingle(),
    ]);
    return {
      collabFunnel: collabFunnel.data ?? null,
      workshopFunnel: workshopFunnel.data ?? null,
      worksFunnel: worksFunnel.data ?? null,
      health: health.data ?? null,
    };
  });

export const getAdminGeo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const [cities, countries] = await Promise.all([
      admin.from("vw_city_activity_7d").select("*").order("active_users", { ascending: false }).limit(500),
      admin.from("vw_country_activity_7d").select("*").limit(250),
    ]);
    return { cities: cities.data ?? [], countries: countries.data ?? [] };
  });

export const getAdminRevenue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const [mrr, statusCounts, failed, subs] = await Promise.all([
      admin.from("vw_mrr_series").select("*"),
      admin.from("vw_subscription_status_counts").select("*"),
      admin.from("vw_failed_payments").select("*"),
      admin
        .from("subscriptions")
        .select("id,user_id,tier,status,environment,current_period_end,created_at,stripe_customer_id")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    return {
      mrr: mrr.data ?? [],
      statusCounts: statusCounts.data ?? [],
      failed: failed.data ?? [],
      recent: subs.data ?? [],
    };
  });

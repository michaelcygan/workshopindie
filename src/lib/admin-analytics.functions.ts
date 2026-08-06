import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { panel, ok, unavailable, type Panel } from "@/lib/analytics/envelope";

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

const v = (admin: any, name: string) => admin.from(name as never);

/**
 * Company pulse. Every headline number on every admin page originates here or
 * from the same vw_* views, so definitions cannot drift between pages.
 */
export const getAdminPulse = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const [kpi, growth, daily, surfaces, cities, countries, revenue, retention] = await Promise.all([
      panel(v(admin, "vw_kpi_periods").select("*").maybeSingle()),
      panel(v(admin, "vw_membership_growth").select("*")),
      panel(v(admin, "vw_dau_daily").select("*")),
      panel(v(admin, "vw_surface_30d").select("*")),
      panel(v(admin, "vw_geo_city_stats").select("*").order("members", { ascending: false }).limit(500)),
      panel(v(admin, "vw_geo_country_stats").select("*").order("members", { ascending: false }).limit(250)),
      panel(v(admin, "vw_revenue_now").select("*").maybeSingle()),
      panel(v(admin, "vw_retention_headline").select("*")),
    ]);
    return { kpi, growth, daily, surfaces, cities, countries, revenue, retention, fetchedAt: new Date().toISOString() };
  });

export const getAdminGrowth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const [funnel, cohorts, referrals, growth, retention, kpi] = await Promise.all([
      panel(v(admin, "vw_acquisition_funnel").select("*").maybeSingle()),
      panel(v(admin, "vw_cohort_retention_weekly").select("*")),
      panel(v(admin, "vw_referral_leaderboard").select("*")),
      panel(v(admin, "vw_membership_growth").select("*")),
      panel(v(admin, "vw_retention_headline").select("*")),
      panel(v(admin, "vw_kpi_periods").select("*").maybeSingle()),
    ]);
    return { funnel, cohorts, referrals, growth, retention, kpi, fetchedAt: new Date().toISOString() };
  });

export const getAdminEngagement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const [surfaces, daily, kpi, weekly] = await Promise.all([
      panel(v(admin, "vw_surface_30d").select("*")),
      panel(v(admin, "vw_dau_daily").select("*")),
      panel(v(admin, "vw_kpi_periods").select("*").maybeSingle()),
      panel(v(admin, "vw_weekly_active_creators").select("*")),
    ]);
    return { surfaces, daily, kpi, weekly, fetchedAt: new Date().toISOString() };
  });

export const getAdminGeo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const [cities, countries, kpi] = await Promise.all([
      panel(v(admin, "vw_geo_city_stats").select("*").order("members", { ascending: false }).limit(500)),
      panel(v(admin, "vw_geo_country_stats").select("*").order("members", { ascending: false }).limit(250)),
      panel(v(admin, "vw_kpi_periods").select("*").maybeSingle()),
    ]);
    return { cities, countries, kpi, fetchedAt: new Date().toISOString() };
  });

export const getAdminRevenue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const [now, series, statusCounts, failed, recent] = await Promise.all([
      panel(v(admin, "vw_revenue_now").select("*").maybeSingle()),
      panel(v(admin, "vw_mrr_series").select("*")),
      panel(v(admin, "vw_subscription_status_counts").select("*")),
      panel(v(admin, "vw_failed_payments").select("*")),
      panel(
        admin
          .from("subscriptions")
          .select("id,user_id,tier,status,environment,current_period_end,created_at")
          .order("created_at", { ascending: false })
          .limit(100),
      ),
    ]);
    return { now, series, statusCounts, failed, recent, fetchedAt: new Date().toISOString() };
  });

export const getAdminMarketplace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const prevSince = new Date(Date.now() - 60 * 86400000).toISOString();

    const [collabFunnel, worksFunnel, health, posts, apps, guestApps] = await Promise.all([
      panel(v(admin, "vw_collab_funnel").select("*").maybeSingle()),
      panel(v(admin, "vw_works_funnel").select("*").maybeSingle()),
      panel(v(admin, "vw_marketplace_health").select("*").maybeSingle()),
      panel(admin.from("collab_posts").select("id,created_at,lifecycle_state").gte("created_at", prevSince)),
      panel(
        admin
          .from("collab_contact_events")
          .select("id,collab_post_id,sender_user_id,sent_at,review_status")
          .gte("sent_at", prevSince),
      ),
      panel(admin.from("collab_guest_applications").select("id,collab_post_id,created_at,status").gte("created_at", prevSince)),
    ]);

    let collabHealth: Panel<any> = unavailable<any>("Collab activity unavailable");
    if (posts.status !== "unavailable" && apps.status !== "unavailable") {
      const postRows = (posts.data ?? []) as any[];
      const appRows = (apps.data ?? []) as any[];
      const guestRows = (guestApps.data ?? []) as any[];
      const cur = (t: string) => t >= since;
      const postsCur = postRows.filter((p) => cur(p.created_at));
      const postsPrev = postRows.filter((p) => !cur(p.created_at));
      const appsCur = appRows.filter((a) => cur(a.sent_at));
      const appsPrev = appRows.filter((a) => !cur(a.sent_at));
      const withApp = new Set(appsCur.map((a) => a.collab_post_id));
      // review_status is the only reliable "someone acted on this application" state.
      const reviewed = appsCur.filter((a) => a.review_status && a.review_status !== "new").length;
      collabHealth = ok({
        posts_30d: postsCur.length,
        posts_prev_30d: postsPrev.length,
        posts_with_application_30d: postsCur.filter((p) => withApp.has(p.id)).length,
        applications_30d: appsCur.length,
        applications_prev_30d: appsPrev.length,
        unique_applicants_30d: new Set(appsCur.map((a) => a.sender_user_id)).size,
        guest_applications_30d: guestRows.filter((g) => cur(g.created_at)).length,
        applications_reviewed_30d: reviewed,
      });
    }

    return { collabFunnel, worksFunnel, health, collabHealth, fetchedAt: new Date().toISOString() };
  });

export const getAdminLoungeAudio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const { data, error } = await admin
      .from("lounge_audio_daily")
      .select("day, minutes, mic_grabs, queue_abandons, reconnects, mic_denials, speaker_joins")
      .order("day", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<Record<string, any>>;
    const byDay = new Map<string, any>();
    for (const r of rows) {
      const agg = byDay.get(r.day) ?? {
        day: r.day, minutes: 0, mic_grabs: 0, queue_abandons: 0, reconnects: 0, mic_denials: 0, speaker_joins: 0,
      };
      agg.minutes += r.minutes;
      agg.mic_grabs += r.mic_grabs;
      agg.queue_abandons += r.queue_abandons;
      agg.reconnects += r.reconnects;
      agg.mic_denials += r.mic_denials;
      agg.speaker_joins += r.speaker_joins;
      byDay.set(r.day, agg);
    }
    const daily = Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day));
    const totals = daily.reduce(
      (acc, d) => ({
        minutes: acc.minutes + d.minutes,
        mic_grabs: acc.mic_grabs + d.mic_grabs,
        queue_abandons: acc.queue_abandons + d.queue_abandons,
        reconnects: acc.reconnects + d.reconnects,
        mic_denials: acc.mic_denials + d.mic_denials,
        speaker_joins: acc.speaker_joins + d.speaker_joins,
      }),
      { minutes: 0, mic_grabs: 0, queue_abandons: 0, reconnects: 0, mic_denials: 0, speaker_joins: 0 },
    );
    return { daily, totals };
  });

/** Investor View: aggregate only, no PII. */
export const getInvestorSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const [kpi, growth, retention, cohorts, surfaces, cities, countries, revenue, funnel] = await Promise.all([
      panel(v(admin, "vw_kpi_periods").select("*").maybeSingle()),
      panel(v(admin, "vw_membership_growth").select("*")),
      panel(v(admin, "vw_retention_headline").select("*")),
      panel(v(admin, "vw_cohort_retention_weekly").select("*")),
      panel(v(admin, "vw_surface_30d").select("*")),
      panel(v(admin, "vw_geo_city_stats").select("*").order("members", { ascending: false }).limit(200)),
      panel(v(admin, "vw_geo_country_stats").select("*").order("members", { ascending: false }).limit(200)),
      panel(v(admin, "vw_revenue_now").select("*").maybeSingle()),
      panel(v(admin, "vw_acquisition_funnel").select("*").maybeSingle()),
    ]);
    return { kpi, growth, retention, cohorts, surfaces, cities, countries, revenue, funnel, fetchedAt: new Date().toISOString() };
  });

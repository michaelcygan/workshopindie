/**
 * `getUsageSummary` — one server call that returns this month's usage against
 * every Workshop Free-tier limit, for the settings "This month" panel.
 *
 * Numbers come from the same authoritative sources the individual gates
 * consult (RPCs and table counts), so the summary can't drift from the
 * enforcement path.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UsageSummary = {
  tier: "free" | "plus";
  resetLabel: string;
  blog: { used: number; cap: number | null };
  loungeAudio: { used: number; cap: number | null };
  publishedWorks: { used: number; cap: number | null };
  openCollabs: { used: number; cap: number | null };
};

function nextMonthResetLabel(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return next.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export const getUsageSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UsageSummary> => {
    const { resolveLoungeAudioAccess } = await import("./lounge-access.server");
    const { resolveEntitlements } = await import("./entitlements");
    type SubscriptionLike = import("./entitlements").SubscriptionLike;

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // Subscription → entitlements
    const { data: subRow } = await supabaseAdmin
      .from("subscriptions")
      .select("status,tier,current_period_end")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const entitlements = resolveEntitlements(subRow as SubscriptionLike);

    // Blog publications this month (advisory RPC used by gate is a consumer;
    // the count function is safe to read on its own).
    const { data: blogUsed } = await context.supabase.rpc(
      "blog_member_publications_this_month",
      { _user_id: context.userId },
    );

    // Lounge audio minutes this month + limit.
    const lounge = await resolveLoungeAudioAccess(context.userId);

    // Published works count.
    const { count: worksCount } = await context.supabase
      .from("works")
      .select("id", { count: "exact", head: true })
      .eq("created_by", context.userId)
      .eq("status", "published");

    // Active open collabs count.
    const { count: openCollabsCount } = await context.supabase
      .from("collab_posts")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", context.userId)
      .eq("status", "open");

    return {
      tier: entitlements.tier,
      resetLabel: nextMonthResetLabel(),
      blog: {
        used: typeof blogUsed === "number" ? blogUsed : 0,
        cap: entitlements.blogPublicationsPerMonth,
      },
      loungeAudio: {
        used: lounge.minutesUsed,
        cap: lounge.monthlyLimit,
      },
      publishedWorks: {
        used: worksCount ?? 0,
        cap: entitlements.maxPublishedWorks,
      },
      openCollabs: {
        used: openCollabsCount ?? 0,
        cap: entitlements.maxOpenCollabs,
      },
    };
  });

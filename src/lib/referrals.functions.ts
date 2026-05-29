import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyReferralInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", userId)
      .maybeSingle();

    const { data: stats } = await supabase.rpc("get_referral_stats", {
      _user_id: userId,
    });

    const row = Array.isArray(stats) ? stats[0] : stats;

    return {
      username: (profile?.username as string | null) ?? null,
      displayName: (profile?.display_name as string | null) ?? null,
      stats: {
        signedUp: (row?.signed_up_count as number) ?? 0,
        paid: (row?.paid_count as number) ?? 0,
        monthsEarned: (row?.months_earned as number) ?? 0,
        pendingMonths: (row?.pending_months as number) ?? 0,
      },
    };
  });

/**
 * Server-only helper resolving a user's Lounge-audio monthly quota.
 *
 * Free / lapsed subscribers are capped at FREE_LOUNGE_MINUTES_PER_MONTH per
 * UTC calendar month. Plus / trial subscribers have `monthlyLimit = null`
 * (unlimited). Usage is counted authoritatively from the
 * `lounge_audio_events` table via `public.lounge_minutes_this_month`.
 */
import { resolveEntitlements } from "@/lib/entitlements";

function nextMonthResetLabel(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return next.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export type LoungeAudioAccess = {
  minutesUsed: number;
  monthlyLimit: number | null;
  minutesRemaining: number | null;
  canJoinAudio: boolean;
  resetLabel: string;
  reason: string | null;
};

export async function resolveLoungeAudioAccess(
  userId: string,
): Promise<LoungeAudioAccess> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { resolveEffectivePlusAccess } = await import("./plus-access.server");

  const access = await resolveEffectivePlusAccess(userId);
  const entitlements = resolveEntitlements(access);
  const monthlyLimit = entitlements.loungeMinutesPerMonth;

  if (monthlyLimit == null) {
    return {
      minutesUsed: 0,
      monthlyLimit: null,
      minutesRemaining: null,
      canJoinAudio: true,
      resetLabel: nextMonthResetLabel(),
      reason: null,
    };
  }

  const { data: used } = await supabaseAdmin.rpc("lounge_minutes_this_month", {
    _user_id: userId,
  });
  const minutesUsed = typeof used === "number" ? used : 0;
  const minutesRemaining = Math.max(0, monthlyLimit - minutesUsed);
  const canJoinAudio = minutesUsed < monthlyLimit;
  const resetLabel = nextMonthResetLabel();

  return {
    minutesUsed,
    monthlyLimit,
    minutesRemaining,
    canJoinAudio,
    resetLabel,
    reason: canJoinAudio
      ? null
      : `You've used all ${monthlyLimit} min of Lounge audio this month. Resets ${resetLabel}.`,
  };
}

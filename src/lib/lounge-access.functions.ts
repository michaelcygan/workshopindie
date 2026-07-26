/**
 * Server functions for the Lounge-audio monthly quota (Wave 3).
 *
 *  - `getLoungeAudioAccess`: read the caller's current usage / limit for UI.
 *  - `reserveLoungeMinute`: atomically consume one minute against the caller's
 *    monthly cap. Called once per minute while the SFU session is joined.
 *
 * Both are best-effort from the client's perspective; the DB RPCs are the
 * source of truth for enforcement.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getLoungeAudioAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveLoungeAudioAccess } = await import("./lounge-access.server");
    return resolveLoungeAudioAccess(context.userId);
  });

export const reserveLoungeMinute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId?: string | null }) =>
    z.object({ roomId: z.string().uuid().nullable().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { resolveLoungeAudioAccess } = await import("./lounge-access.server");
    const access = await resolveLoungeAudioAccess(context.userId);

    // Unlimited (Plus / trial): still write a telemetry row so analytics
    // reflect real minutes, but never block.
    if (access.monthlyLimit == null) {
      await context.supabase.from("lounge_audio_events").insert({
        user_id: context.userId,
        room_id: data.roomId ?? null,
        event: "connected_minutes",
        payload: {},
      });
      return {
        ok: true as const,
        minutesUsed: access.minutesUsed + 1,
        minutesRemaining: null as number | null,
        monthlyLimit: null as number | null,
        reason: null as string | null,
      };
    }

    const { data: reserved, error } = await context.supabase.rpc(
      "try_reserve_lounge_minute",
      {
        _user_id: context.userId,
        _room_id: (data.roomId ?? null) as string,
        _limit: access.monthlyLimit,
      },
    );

    if (error) {
      // Fail-open on transient DB errors so the audio path doesn't drop.
      return {
        ok: true as const,
        minutesUsed: access.minutesUsed,
        minutesRemaining: access.minutesRemaining,
        monthlyLimit: access.monthlyLimit,
        reason: null,
      };
    }

    if (reserved === true) {
      return {
        ok: true as const,
        minutesUsed: access.minutesUsed + 1,
        minutesRemaining: Math.max(0, access.monthlyLimit - (access.minutesUsed + 1)),
        monthlyLimit: access.monthlyLimit,
        reason: null,
      };
    }

    return {
      ok: false as const,
      minutesUsed: access.minutesUsed,
      minutesRemaining: 0,
      monthlyLimit: access.monthlyLimit,
      reason:
        access.reason ??
        `You've used all ${access.monthlyLimit} min of Lounge audio this month. Resets ${access.resetLabel}.`,
    };
  });

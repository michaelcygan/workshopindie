import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const codeSchema = z.string().trim().min(4).max(64).regex(/^[A-Za-z0-9_-]+$/);

export const redeemCompMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => ({ code: codeSchema.parse(d.code) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const codeUpper = data.code.toUpperCase();

    // Rate limit: 10 attempts per hour per user
    const { data: ok } = await supabase.rpc("check_and_bump", {
      _action: "comp_redeem",
      _key: userId,
      _window_s: 3600,
      _max: 10,
    });
    if (ok === false) throw new Error("Too many attempts. Try again later.");

    const { data: comp, error } = await supabase
      .from("comp_memberships")
      .select("id, status, duration_months, granted_to")
      .eq("code", codeUpper)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!comp) throw new Error("That code isn't valid.");
    if (comp.status !== "unredeemed") throw new Error("This code has already been redeemed.");

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + (comp.duration_months ?? 12));

    const { error: upErr } = await supabase
      .from("comp_memberships")
      .update({
        status: "redeemed",
        redeemed_at: new Date().toISOString(),
        granted_to: userId,
        expires_at: expiresAt.toISOString(),
      })
      .eq("id", comp.id)
      .eq("status", "unredeemed");
    if (upErr) throw new Error(upErr.message);

    // Grant Plus via subscriptions row (no stripe_subscription_id)
    const { error: subErr } = await supabase
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          tier: "plus",
          status: "active",
          current_period_end: expiresAt.toISOString(),
          environment: "live",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (subErr) throw new Error(subErr.message);

    return { ok: true, expiresAt: expiresAt.toISOString() };
  });

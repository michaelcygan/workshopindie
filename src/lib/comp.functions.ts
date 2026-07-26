import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const codeSchema = z.string().trim().min(4).max(64).regex(/^[A-Za-z0-9_-]+$/);

/**
 * Legacy comp-code redemption. New comp benefits flow through the
 * `plus_access_grants` ledger via `applyComplimentaryPlusBenefit` so they
 * are visible in the admin Plus panel and unified with all other sources.
 * The `subscriptions` row is left untouched (Stripe owns it).
 */
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

    // Mark comp code redeemed atomically.
    const { error: upErr } = await supabase
      .from("comp_memberships")
      .update({
        status: "redeemed",
        redeemed_at: new Date().toISOString(),
        granted_to: userId,
      })
      .eq("id", comp.id)
      .eq("status", "unredeemed");
    if (upErr) throw new Error(upErr.message);

    // Grant Plus via the ledger (stacked with any existing timed grants).
    const { applyComplimentaryPlusBenefit } = await import("@/lib/plus-benefits.server");
    const result = await applyComplimentaryPlusBenefit({
      userId,
      source: "legacy_comp",
      sourceId: comp.id,
      benefitType: "months",
      durationMonths: comp.duration_months ?? 12,
      note: `Legacy comp code ${codeUpper}`,
    });

    // Persist the resolved expires_at back onto the comp row for continuity.
    if (result.accessEndsAt) {
      await supabase
        .from("comp_memberships")
        .update({ expires_at: result.accessEndsAt })
        .eq("id", comp.id);
    }

    return { ok: true, expiresAt: result.accessEndsAt };
  });

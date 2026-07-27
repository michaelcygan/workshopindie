/**
 * Marketing offer links for Workshop Plus.
 *
 * Admins create offer links; the plaintext token is returned exactly once
 * on creation and never stored (only a SHA-256 hash is persisted).
 * Redemption is atomic via the `claim_plus_offer` RPC in the database.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { randomBytes, createHash } from "crypto";
import { logAdminAction } from "@/lib/admin-audit.functions";

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

function hashToken(token: string): string {
  // Postgres bytea hex format so supabase-js sends it back as bytea.
  return "\\x" + createHash("sha256").update(token).digest("hex");
}

const createOfferSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).nullable().optional(),
    benefitType: z.enum(["months", "lifetime"]),
    durationMonths: z.number().int().min(1).max(120).nullable().optional(),
    maxRedemptions: z.number().int().min(1).max(100000).nullable().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
  })
  .refine((d) => d.benefitType !== "months" || (d.durationMonths && d.durationMonths > 0), {
    message: "durationMonths is required for month-based offers",
    path: ["durationMonths"],
  });

export const adminCreatePlusOfferLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createOfferSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const env = process.env.NODE_ENV === "production" ? "live" : "sandbox";

    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);

    const { data: row, error } = await admin
      .from("plus_offer_links")
      .insert({
        name: data.name,
        description: data.description ?? null,
        benefit_type: data.benefitType,
        duration_months: data.durationMonths ?? null,
        environment: env,
        token_hash: tokenHash,
        max_redemptions: data.maxRedemptions ?? null,
        expires_at: data.expiresAt ?? null,
        active: true,
        created_by: context.userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await logAdminAction(context.supabase, "plus_offer_create", "plus_offer_link", (row as any).id, {
      name: data.name,
      benefitType: data.benefitType,
      durationMonths: data.durationMonths ?? null,
      maxRedemptions: data.maxRedemptions ?? null,
      expiresAt: data.expiresAt ?? null,
    });

    return { id: (row as any).id, token };
  });

export const adminListPlusOfferLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const { data, error } = await admin
      .from("plus_offer_links")
      .select(
        "id,name,description,benefit_type,duration_months,environment,max_redemptions,redemption_count,expires_at,active,created_at,created_by",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminDeactivatePlusOfferLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: z.string().uuid().parse(d.id) }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const { error } = await admin
      .from("plus_offer_links")
      .update({ active: false } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAdminAction(context.supabase, "plus_offer_deactivate", "plus_offer_link", data.id, {});
    return { ok: true };
  });

export const adminListOfferRedemptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: z.string().uuid().parse(d.id) }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const { data: rows, error } = await admin
      .from("plus_offer_redemptions")
      .select("id,user_id,grant_id,redeemed_at")
      .eq("offer_id", data.id)
      .order("redeemed_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const userIds = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    const { data: users } = userIds.length
      ? await admin.from("profiles").select("id,username,display_name,avatar_url").in("id", userIds)
      : { data: [] as any[] };
    const map = new Map((users ?? []).map((u: any) => [u.id, u]));
    return (rows ?? []).map((r: any) => ({ ...r, user: map.get(r.user_id) ?? null }));
  });

export const claimPlusOfferByToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { token: string }) => ({
    token: z.string().min(10).max(200).parse(d.token),
  }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase.rpc("claim_plus_offer", { _token: data.token });
    if (error) return { error: error.message };
    const first = Array.isArray(rows) ? rows[0] : rows;
    if (!first) return { error: "Claim failed" };
    return {
      grantId: (first as any).grant_id,
      benefitType: (first as any).benefit_type,
      accessEndsAt: (first as any).access_ends_at as string | null,
    };
  });

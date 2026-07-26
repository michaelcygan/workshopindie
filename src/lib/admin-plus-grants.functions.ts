/**
 * Admin-only Workshop Plus grant management.
 *
 * All mutations write to `admin_audit_log` via `admin_log` RPC and notify
 * the target user via `notifications`. Reads and revocations are gated by
 * an explicit `requireAdmin` role check (not just an authenticated caller).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { logAdminAction } from "@/lib/admin-audit.functions";
import { applyComplimentaryPlusBenefit } from "@/lib/plus-benefits.server";
import { resolveEffectivePlusAccess } from "@/lib/plus-access.server";

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

async function notifyPlus(
  targetUserId: string,
  kind: "plus_granted" | "plus_revoked",
  payload: Record<string, unknown>,
) {
  const admin = await getAdmin();
  await admin.from("notifications").insert({
    user_id: targetUserId,
    kind,
    entity_type: "plus_access_grant",
    entity_id: (payload.grantId as string) ?? null,
    payload,
  } as never);
}

export const listUserPlusGrants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => ({ userId: z.string().uuid().parse(d.userId) }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const [grantsRes, access] = await Promise.all([
      admin
        .from("plus_access_grants")
        .select(
          "id,benefit_type,duration_months,status,source,source_id,access_starts_at,access_ends_at,application_method,note,granted_by,revoked_by,created_at,applied_at,revoked_at",
        )
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false }),
      resolveEffectivePlusAccess(data.userId),
    ]);
    if (grantsRes.error) throw new Error(grantsRes.error.message);
    const grants = grantsRes.data ?? [];
    const actorIds = Array.from(
      new Set(
        grants.flatMap((g: any) => [g.granted_by, g.revoked_by]).filter(Boolean) as string[],
      ),
    );
    const { data: actors } = actorIds.length
      ? await admin.from("profiles").select("id,username,display_name").in("id", actorIds)
      : { data: [] as any[] };
    const actorMap = new Map((actors ?? []).map((a: any) => [a.id, a]));
    return {
      access,
      grants: grants.map((g: any) => ({
        ...g,
        grantedByProfile: g.granted_by ? actorMap.get(g.granted_by) ?? null : null,
        revokedByProfile: g.revoked_by ? actorMap.get(g.revoked_by) ?? null : null,
      })),
    };
  });

const createSchema = z
  .object({
    userId: z.string().uuid(),
    benefitType: z.enum(["months", "lifetime"]),
    durationMonths: z.number().int().min(1).max(120).nullable().optional(),
    note: z.string().max(500).nullable().optional(),
  })
  .refine(
    (d) => d.benefitType !== "months" || (d.durationMonths && d.durationMonths > 0),
    { message: "durationMonths is required for month-based grants", path: ["durationMonths"] },
  );

export const createAdminPlusGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const result = await applyComplimentaryPlusBenefit({
      userId: data.userId,
      source: "admin_direct",
      benefitType: data.benefitType,
      durationMonths: data.durationMonths ?? null,
      note: data.note ?? null,
      grantedBy: context.userId,
    });
    await logAdminAction(context.supabase, "plus_grant_create", "profile", data.userId, {
      grantId: result.grantId,
      benefitType: result.benefitType,
      durationMonths: data.durationMonths ?? null,
      note: data.note ?? null,
    });
    await notifyPlus(data.userId, "plus_granted", {
      grantId: result.grantId,
      benefitType: result.benefitType,
      accessEndsAt: result.accessEndsAt,
      source: "admin_direct",
    });
    return result;
  });

export const revokeAdminPlusGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { grantId: string; reason?: string | null }) =>
    z.object({ grantId: z.string().uuid(), reason: z.string().max(500).nullable().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const { data: existing, error: getErr } = await admin
      .from("plus_access_grants")
      .select("id, user_id, status, benefit_type")
      .eq("id", data.grantId)
      .maybeSingle();
    if (getErr) throw new Error(getErr.message);
    if (!existing) throw new Error("Grant not found");
    if ((existing as any).status === "revoked") return { ok: true, alreadyRevoked: true };

    const { error: upErr } = await admin
      .from("plus_access_grants")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        revoked_by: context.userId,
        note: data.reason ?? null,
      } as never)
      .eq("id", data.grantId);
    if (upErr) throw new Error(upErr.message);

    await logAdminAction(context.supabase, "plus_grant_revoke", "profile", (existing as any).user_id, {
      grantId: data.grantId,
      benefitType: (existing as any).benefit_type,
      reason: data.reason ?? null,
    });
    await notifyPlus((existing as any).user_id, "plus_revoked", {
      grantId: data.grantId,
      benefitType: (existing as any).benefit_type,
      reason: data.reason ?? null,
    });
    return { ok: true };
  });

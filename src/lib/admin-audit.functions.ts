import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles").select("role")
    .eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (error || !data) throw new Error("Forbidden: admin only");
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number; action?: string; targetType?: string }) => d)
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    let q = admin
      .from("admin_audit_log")
      .select("id,actor_user_id,action,target_type,target_id,payload,created_at")
      .order("created_at", { ascending: false })
      .limit(Math.min(data.limit ?? 200, 500));
    if (data.action) q = q.eq("action", data.action);
    if (data.targetType) q = q.eq("target_type", data.targetType);
    const { data: rows, error } = await q;
    if (error) throw error;
    const actorIds = Array.from(new Set((rows ?? []).map((r) => r.actor_user_id).filter(Boolean)));
    const { data: profiles } = await admin
      .from("profiles")
      .select("id,username,display_name,avatar_url")
      .in("id", actorIds.length ? actorIds : ["00000000-0000-0000-0000-000000000000"]);
    const map = new Map((profiles ?? []).map((p) => [p.id, p]));
    return (rows ?? []).map((r) => ({ ...r, actor: map.get(r.actor_user_id) ?? null }));
  });

export async function logAdminAction(
  supabase: any,
  action: string,
  targetType: string | null,
  targetId: string | null,
  payload: Record<string, unknown> = {},
) {
  // Uses the RLS-scoped supabase client; admin_log() RPC also checks role server-side.
  await supabase.rpc("admin_log", {
    _action: action,
    _target_type: targetType,
    _target_id: targetId,
    _payload: payload as any,
  });
}

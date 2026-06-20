import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logAdminAction } from "@/lib/admin-audit.functions";

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

// ---------- Feature flags ----------
export const listFeatureFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const { data, error } = await admin.from("feature_flags").select("*").order("key");
    if (error) throw error;
    return data ?? [];
  });

export const upsertFeatureFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { key: string; enabled: boolean; rollout_pct: number; notes?: string | null }) => d)
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const { error } = await admin.from("feature_flags").upsert({
      key: data.key,
      enabled: data.enabled,
      rollout_pct: data.rollout_pct,
      notes: data.notes ?? null,
      updated_at: new Date().toISOString(),
      updated_by: context.userId,
    });
    if (error) throw error;
    await logAdminAction(context.supabase, "flag.upsert", "feature_flag", null, { key: data.key, enabled: data.enabled, rollout_pct: data.rollout_pct });
    return { ok: true };
  });

export const deleteFeatureFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { key: string }) => d)
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    await admin.from("feature_flags").delete().eq("key", data.key);
    await logAdminAction(context.supabase, "flag.delete", "feature_flag", null, { key: data.key });
    return { ok: true };
  });

// ---------- Broadcasts (in-app notifications only) ----------
export const sendAdminBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { title: string; body: string; audience: "all" | "plus" | "active_30d" }) => d)
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    let userIds: string[] = [];
    if (data.audience === "all") {
      const { data: users } = await admin.from("profiles").select("id").is("deleted_at", null);
      userIds = (users ?? []).map((u) => u.id);
    } else if (data.audience === "plus") {
      const { data: users } = await admin
        .from("subscriptions")
        .select("user_id")
        .eq("tier", "plus")
        .in("status", ["active", "trialing"]);
      userIds = Array.from(new Set((users ?? []).map((u) => u.user_id)));
    } else {
      const since = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
      const { data: users } = await admin
        .from("profiles").select("id").gte("last_active_at", since).is("deleted_at", null);
      userIds = (users ?? []).map((u) => u.id);
    }
    if (userIds.length === 0) return { ok: true, recipients: 0 };
    const payload = { title: data.title, body: data.body };
    // chunked insert
    const chunk = 500;
    for (let i = 0; i < userIds.length; i += chunk) {
      const slice = userIds.slice(i, i + chunk).map((uid) => ({
        user_id: uid,
        kind: "admin_broadcast",
        actor_user_id: context.userId,
        entity_type: "broadcast",
        entity_id: null as any,
        payload,
      }));
      await admin.from("notifications").insert(slice);
    }
    await admin.from("admin_broadcasts").insert({
      sent_by: context.userId,
      title: data.title,
      body: data.body,
      audience: { kind: data.audience },
      recipients_count: userIds.length,
    });
    await logAdminAction(context.supabase, "broadcast.send", "broadcast", null, {
      audience: data.audience, recipients: userIds.length, title: data.title,
    });
    return { ok: true, recipients: userIds.length };
  });

export const listAdminBroadcasts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const { data } = await admin.from("admin_broadcasts").select("*").order("sent_at", { ascending: false }).limit(50);
    return data ?? [];
  });

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

// Moderation terms
export const listModerationTerms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const { data } = await admin.from("moderation_terms").select("*").order("term");
    return data ?? [];
  });

export const upsertModerationTerm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; term: string; severity: "block" | "warn"; notes?: string | null }) => d)
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    if (data.id) {
      await admin.from("moderation_terms").update({ term: data.term, severity: data.severity, notes: data.notes ?? null }).eq("id", data.id);
    } else {
      await admin.from("moderation_terms").insert({ term: data.term, severity: data.severity, notes: data.notes ?? null });
    }
    await logAdminAction(context.supabase, "mod.term.upsert", "moderation_term", null, { term: data.term, severity: data.severity });
    return { ok: true };
  });

export const deleteModerationTerm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    await admin.from("moderation_terms").delete().eq("id", data.id);
    await logAdminAction(context.supabase, "mod.term.delete", "moderation_term", data.id, {});
    return { ok: true };
  });

// Mod rules
export const listModRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const { data } = await admin.from("mod_rules").select("*").order("key");
    return data ?? [];
  });

export const upsertModRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; key: string; enabled: boolean; threshold?: number | null; window_seconds?: number | null; action: string; notes?: string | null }) => d)
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const payload = {
      key: data.key, enabled: data.enabled,
      threshold: data.threshold ?? null, window_seconds: data.window_seconds ?? null,
      action: data.action, notes: data.notes ?? null, updated_at: new Date().toISOString(),
    };
    if (data.id) await admin.from("mod_rules").update(payload).eq("id", data.id);
    else await admin.from("mod_rules").upsert(payload, { onConflict: "key" });
    await logAdminAction(context.supabase, "mod.rule.upsert", "mod_rule", null, payload as any);
    return { ok: true };
  });

// Moderation events (admin log of blocks/warns/flags)
export const listModerationEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const { data } = await admin
      .from("moderation_events")
      .select("id, user_id, surface, subject_id, category, severity, term_hash, created_at, profiles:profiles!moderation_events_user_id_fkey(display_name, username)")
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });


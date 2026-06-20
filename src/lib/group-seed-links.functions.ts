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

// Base32 (Crockford-ish) without ambiguous chars
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function newToken(len = 8) {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return s;
}

export const createGroupSeedLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    group_id: string;
    label?: string | null;
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
  }) => d)
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();

    // Generate a unique token (retry on collision; vanishingly rare)
    let token = newToken();
    for (let i = 0; i < 5; i++) {
      const { data: existing } = await admin
        .from("group_seed_links")
        .select("id")
        .eq("token", token)
        .maybeSingle();
      if (!existing) break;
      token = newToken();
    }

    const { data: row, error } = await admin
      .from("group_seed_links")
      .insert({
        group_id: data.group_id,
        token,
        label: data.label?.trim() || null,
        utm_source: data.utm_source?.trim() || null,
        utm_medium: data.utm_medium?.trim() || null,
        utm_campaign: data.utm_campaign?.trim() || null,
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw error;

    await logAdminAction(
      context.supabase,
      "group_seed_link.create",
      "group",
      data.group_id,
      { token, label: row.label },
    );

    return { link: row };
  });

export const listGroupSeedLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const { data: rows, error } = await admin
      .from("group_seed_links")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    const groupIds = Array.from(new Set((rows ?? []).map((r) => r.group_id)));
    const { data: groups } = await admin
      .from("groups")
      .select("id,name,slug,accent_color,kind")
      .in("id", groupIds.length ? groupIds : ["00000000-0000-0000-0000-000000000000"]);
    const map = new Map((groups ?? []).map((g) => [g.id, g]));
    return {
      links: (rows ?? []).map((r) => ({ ...r, group: map.get(r.group_id) ?? null })),
    };
  });

export const updateGroupSeedLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id: string;
    patch: Partial<{
      label: string | null;
      utm_source: string | null;
      utm_medium: string | null;
      utm_campaign: string | null;
      is_active: boolean;
    }>;
  }) => d)
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const { data: row, error } = await admin
      .from("group_seed_links")
      .update(data.patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw error;
    await logAdminAction(context.supabase, "group_seed_link.update", "group_seed_link", data.id, data.patch);
    return { link: row };
  });

export const deleteGroupSeedLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const { error } = await admin.from("group_seed_links").delete().eq("id", data.id);
    if (error) throw error;
    await logAdminAction(context.supabase, "group_seed_link.delete", "group_seed_link", data.id, {});
    return { ok: true };
  });

export const searchGroupsForSeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q: string }) => d)
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const q = data.q.trim();
    if (!q) {
      const { data: rows } = await admin
        .from("groups")
        .select("id,name,slug,kind,accent_color,member_count")
        .is("deleted_at", null)
        .order("member_count", { ascending: false })
        .limit(15);
      return rows ?? [];
    }
    const { data: rows } = await admin
      .from("groups")
      .select("id,name,slug,kind,accent_color,member_count")
      .is("deleted_at", null)
      .or(`name.ilike.%${q}%,slug.ilike.%${q}%`)
      .order("member_count", { ascending: false })
      .limit(15);
    return rows ?? [];
  });

// ----- Public consumer functions -----

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export const resolveGroupSeedLink = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data }) => {
    const token = data.token?.trim();
    if (!token) return null;
    const sb = publicClient();
    const { data: rows, error } = await sb.rpc("resolve_group_seed_link", { _token: token });
    if (error) return null;
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) return null;
    return {
      group_id: row.group_id as string,
      group_slug: row.group_slug as string,
      group_name: row.group_name as string,
      is_active: row.is_active as boolean,
    };
  });

export const redeemGroupSeedLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("redeem_group_seed_link", {
      _token: data.token,
    });
    if (error) throw error;
    const row = Array.isArray(rows) ? rows[0] : rows;
    return {
      group_id: row?.group_id as string | undefined,
      joined: !!row?.joined,
      already_member: !!row?.already_member,
    };
  });

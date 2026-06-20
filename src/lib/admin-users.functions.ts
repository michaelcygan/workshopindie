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

export const searchAdminUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q: string }) => d)
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const q = data.q.trim();
    if (!q) return [];
    // Search profiles by username/display_name/id
    let prof = await admin
      .from("profiles")
      .select("id,username,display_name,avatar_url,creator_status,home_city_id,created_at,last_active_at,work_count,follower_count")
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(50);
    let rows = prof.data ?? [];
    // Also search auth.users by email (admin)
    if (q.includes("@")) {
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 50 });
      const matched = (list?.users ?? []).filter((u) => u.email?.toLowerCase().includes(q.toLowerCase()));
      if (matched.length) {
        const ids = matched.map((u) => u.id);
        const { data: p2 } = await admin
          .from("profiles")
          .select("id,username,display_name,avatar_url,creator_status,home_city_id,created_at,last_active_at,work_count,follower_count")
          .in("id", ids);
        const have = new Set(rows.map((r) => r.id));
        for (const p of p2 ?? []) if (!have.has(p.id)) rows.push(p);
      }
    }
    return rows;
  });

export const getAdminUserDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const [profile, roles, auth, sub, counts, reportsAgainst, reportsBy] = await Promise.all([
      admin.from("profiles").select("*").eq("id", data.userId).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", data.userId),
      admin.auth.admin.getUserById(data.userId),
      admin.from("subscriptions").select("*").eq("user_id", data.userId).order("created_at", { ascending: false }).limit(5),
      Promise.all([
        admin.from("works").select("id", { count: "exact", head: true }).eq("created_by", data.userId),
        admin.from("collab_posts").select("id", { count: "exact", head: true }).eq("user_id", data.userId),
        admin.from("workshops").select("id", { count: "exact", head: true }).eq("host_user_id", data.userId),
        admin.from("workshop_applications").select("id", { count: "exact", head: true }).eq("user_id", data.userId),
        admin.from("group_event_rsvps").select("event_id", { count: "exact", head: true }).eq("user_id", data.userId),
        admin.from("follows").select("follower_user_id", { count: "exact", head: true }).eq("follower_user_id", data.userId),
        admin.from("reports").select("id", { count: "exact", head: true }).eq("reporter_user_id", data.userId),
      ]),
      admin.from("reports").select("id,entity_type,entity_id,reason,status,created_at").eq("entity_id", data.userId).order("created_at", { ascending: false }).limit(20),
      admin.from("reports").select("id,entity_type,entity_id,reason,status,created_at").eq("reporter_user_id", data.userId).order("created_at", { ascending: false }).limit(20),
    ]);
    return {
      profile: profile.data ?? null,
      roles: (roles.data ?? []).map((r) => r.role),
      email: auth.data?.user?.email ?? null,
      authCreatedAt: auth.data?.user?.created_at ?? null,
      lastSignInAt: auth.data?.user?.last_sign_in_at ?? null,
      subscription: sub.data?.[0] ?? null,
      counts: {
        works: counts[0].count ?? 0,
        collabs: counts[1].count ?? 0,
        workshops: counts[2].count ?? 0,
        workshopApps: counts[3].count ?? 0,
        rsvps: counts[4].count ?? 0,
        following: counts[5].count ?? 0,
        reportsFiled: counts[6].count ?? 0,
      },
      reportsAgainst: reportsAgainst.data ?? [],
      reportsBy: reportsBy.data ?? [],
    };
  });

export const setAdminUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; role: "admin" | "moderator" | "user"; grant: boolean }) => d)
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    if (data.grant) {
      await admin.from("user_roles").upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
    } else {
      await admin.from("user_roles").delete().eq("user_id", data.userId).eq("role", data.role);
    }
    await logAdminAction(context.supabase, data.grant ? "role.grant" : "role.revoke", "user", data.userId, { role: data.role });
    return { ok: true };
  });

export const setAdminUserBadge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; status: string }) => d)
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const { error } = await admin.from("profiles").update({ creator_status: data.status as any }).eq("id", data.userId);
    if (error) throw error;
    await logAdminAction(context.supabase, "badge.set", "user", data.userId, { status: data.status });
    return { ok: true };
  });

export const softDeleteAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    await admin.from("profiles").update({ deleted_at: new Date().toISOString(), discoverable: false, indexable: false }).eq("id", data.userId);
    await logAdminAction(context.supabase, "user.soft_delete", "user", data.userId, {});
    return { ok: true };
  });

export const forceSignOutAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    await admin.auth.admin.signOut(data.userId);
    await logAdminAction(context.supabase, "user.force_signout", "user", data.userId, {});
    return { ok: true };
  });

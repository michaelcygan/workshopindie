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
        admin.from("instant_rooms").select("id", { count: "exact", head: true }).eq("creator_id", data.userId),
        admin.from("blog_posts").select("id", { count: "exact", head: true }).eq("created_by", data.userId),
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
        lounges: counts[2].count ?? 0,
        blogPosts: counts[3].count ?? 0,
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

/* ------------------------------------------------------------------ *
 * Users directory: browsable by default, searchable when you need it. *
 * ------------------------------------------------------------------ */

export type AdminUserFilters = {
  q?: string;
  cityId?: string | null;
  activated?: "any" | "yes" | "no";
  plus?: "any" | "yes" | "no";
  role?: "any" | "admin" | "moderator";
  joinedWithinDays?: number | null;
  activeWithinDays?: number | null;
  includeExcluded?: boolean;
  sort?: "recent" | "last_active" | "works" | "followers";
  page?: number;
  pageSize?: number;
};

const USER_COLS =
  "id,username,display_name,avatar_url,creator_status,home_city_id,created_at,last_active_at,work_count,follower_count,onboarded,deleted_at,analytics_excluded";

export const listAdminUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: AdminUserFilters) => d ?? {})
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();

    const page = Math.max(1, data.page ?? 1);
    const pageSize = Math.min(100, Math.max(10, data.pageSize ?? 25));
    const from = (page - 1) * pageSize;

    let query = admin.from("profiles").select(USER_COLS, { count: "exact" });

    const q = (data.q ?? "").trim();
    let emailIds: string[] = [];
    if (q) {
      if (q.includes("@")) {
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        emailIds = (list?.users ?? []).filter((u) => u.email?.toLowerCase().includes(q.toLowerCase())).map((u) => u.id);
      }
      const or = [`username.ilike.%${q}%`, `display_name.ilike.%${q}%`];
      if (emailIds.length) or.push(`id.in.(${emailIds.join(",")})`);
      query = query.or(or.join(","));
    }
    if (data.cityId) query = query.eq("home_city_id", data.cityId);
    if (!data.includeExcluded) query = query.or("analytics_excluded.is.null,analytics_excluded.eq.false");
    if (data.joinedWithinDays)
      query = query.gte("created_at", new Date(Date.now() - data.joinedWithinDays * 86400000).toISOString());
    if (data.activeWithinDays)
      query = query.gte("last_active_at", new Date(Date.now() - data.activeWithinDays * 86400000).toISOString());

    if (data.role && data.role !== "any") {
      const { data: roleRows } = await admin.from("user_roles").select("user_id").eq("role", data.role);
      const ids = (roleRows ?? []).map((r: any) => r.user_id);
      if (!ids.length) return { rows: [], total: 0, page, pageSize };
      query = query.in("id", ids);
    }

    const sort = data.sort ?? "recent";
    const orderCol =
      sort === "last_active" ? "last_active_at" : sort === "works" ? "work_count" : sort === "followers" ? "follower_count" : "created_at";
    query = query.order(orderCol, { ascending: false, nullsFirst: false }).range(from, from + pageSize - 1);

    const { data: rows, count, error } = await query;
    if (error) throw new Error(error.message);
    const profiles = (rows ?? []) as any[];
    const ids = profiles.map((p) => p.id);
    if (!ids.length) return { rows: [], total: count ?? 0, page, pageSize };

    const cityIds = Array.from(new Set(profiles.map((p) => p.home_city_id).filter(Boolean)));
    const [activation, subs, roles, cities] = await Promise.all([
      admin.from("vw_user_activation" as never).select("user_id,activated,first_action_day,first_action_surface").in("user_id", ids),
      admin.from("subscriptions").select("user_id,tier,status,environment,current_period_end").in("user_id", ids),
      admin.from("user_roles").select("user_id,role").in("user_id", ids),
      cityIds.length
        ? admin.from("cities").select("id,name,country").in("id", cityIds as string[])
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const actMap = new Map((activation.data ?? []).map((a: any) => [a.user_id, a]));
    const cityMap = new Map(((cities as any).data ?? []).map((c: any) => [c.id, c]));
    const roleMap = new Map<string, string[]>();
    for (const r of (roles.data ?? []) as any[]) roleMap.set(r.user_id, [...(roleMap.get(r.user_id) ?? []), r.role]);
    const plusSet = new Set(
      ((subs.data ?? []) as any[])
        .filter(
          (s) =>
            s.tier === "plus" &&
            s.environment === "live" &&
            (s.status === "active" || s.status === "trialing") &&
            (!s.current_period_end || new Date(s.current_period_end) > new Date()),
        )
        .map((s) => s.user_id),
    );

    let out = profiles.map((p) => {
      const a: any = actMap.get(p.id);
      const city: any = p.home_city_id ? cityMap.get(p.home_city_id) : null;
      return {
        ...p,
        city_name: city ? `${city.name}${city.country ? `, ${city.country}` : ""}` : null,
        activated: !!a?.activated,
        first_action_day: a?.first_action_day ?? null,
        first_action_surface: a?.first_action_surface ?? null,
        roles: roleMap.get(p.id) ?? [],
        is_plus: plusSet.has(p.id),
      };
    });

    // Activation and Plus live outside the profiles table, so filter after joining.
    if (data.activated === "yes") out = out.filter((u) => u.activated);
    if (data.activated === "no") out = out.filter((u) => !u.activated);
    if (data.plus === "yes") out = out.filter((u) => u.is_plus);
    if (data.plus === "no") out = out.filter((u) => !u.is_plus);

    return { rows: out, total: count ?? out.length, page, pageSize };
  });

/** Exclude test/system/internal accounts from every analytics view. */
export const setAnalyticsExcluded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; excluded: boolean }) => d)
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const { error } = await admin.from("profiles").update({ analytics_excluded: data.excluded }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    await logAdminAction(context.supabase, "analytics.exclude", "user", data.userId, { excluded: data.excluded });
    return { ok: true };
  });

/** Cities that have at least one member, for the Users city filter. */
export const listAdminUserCities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const { data } = await admin
      .from("vw_geo_city_stats" as never)
      .select("city_id,name,country,members")
      .order("members", { ascending: false })
      .limit(300);
    return ((data ?? []) as any[]).map((c) => ({ id: c.city_id, label: `${c.name}${c.country ? `, ${c.country}` : ""}`, members: c.members }));
  });

/**
 * Per-member activity: 90 days of the immutable activity spine plus the
 * member's activation row and home city. Panel-wrapped so a failed query
 * never renders as an honest-looking zero.
 */
export const getAdminUserActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { panel } = await import("@/lib/analytics/envelope");
    const admin = await getAdmin();
    const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);

    const [days, activation, profile] = await Promise.all([
      panel<any[]>(
        admin
          .from("vw_user_activity_day" as never)
          .select("day,surface,is_creative,actions")
          .eq("user_id", data.userId)
          .gte("day", since)
          .order("day", { ascending: true })
          .limit(2000),
      ),
      panel<any>(
        admin
          .from("vw_user_activation" as never)
          .select("user_id,created_at,onboarded,first_action_day,first_action_surface,activated")
          .eq("user_id", data.userId)
          .maybeSingle(),
      ),
      panel<any>(admin.from("profiles").select("home_city_id,analytics_excluded").eq("id", data.userId).maybeSingle()),
    ]);

    let city: { name: string; country: string | null } | null = null;
    const cityId = (profile.data as any)?.home_city_id ?? null;
    if (cityId) {
      const { data: c } = await admin.from("cities").select("name,country").eq("id", cityId).maybeSingle();
      if (c) city = { name: (c as any).name, country: (c as any).country ?? null };
    }

    return {
      days,
      activation,
      city,
      analyticsExcluded: !!(profile.data as any)?.analytics_excluded,
      since,
      fetchedAt: new Date().toISOString(),
    };
  });

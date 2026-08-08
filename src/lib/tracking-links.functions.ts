import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { domainError } from "@/lib/errors";
import { panel } from "@/lib/analytics/envelope";
import {
  isValidTrackingSlug,
  normalizeDestination,
  slugifyTrackingLink,
  TRACKING_LINK_NAME_MAX,
} from "@/lib/tracking-links.shared";

/**
 * Tracking links — admin CRUD plus the one public write path (member
 * attribution). Follows the existing admin convention: authenticated request,
 * explicit admin-role check, then the service client for the query.
 */

async function requireAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw domainError("FORBIDDEN", "Forbidden: admin only");
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const listTrackingLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const { data, error } = await (admin.from("vw_tracking_link_stats" as never) as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw domainError("NOT_FOUND", error.message);
    return { links: (data ?? []) as any[] };
  });

export const createTrackingLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; destination: string; slug?: string | null }) => ({
    name: String(d.name ?? "").trim().slice(0, TRACKING_LINK_NAME_MAX),
    destination: String(d.destination ?? "").trim(),
    slug: d.slug ? String(d.slug).trim() : null,
  }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    if (!data.name) throw domainError("INVALID_INPUT", "Name is required.");

    const dest = normalizeDestination(data.destination);
    if (!dest.ok) throw domainError("INVALID_INPUT", dest.message);

    const slug = slugifyTrackingLink(data.slug || data.name);
    if (!isValidTrackingSlug(slug)) {
      throw domainError("INVALID_INPUT", "That name or slug doesn't produce a usable link.");
    }

    const admin = await getAdmin();
    const { data: link, error } = await (admin.from("tracking_links" as never) as any)
      .insert({
        slug,
        name: data.name,
        destination_path: dest.path,
        created_by: context.userId,
      })
      .select("id,slug,name,destination_path,is_active,created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        throw domainError("ALREADY_EXISTS", `The slug "${slug}" is already taken. Try another.`);
      }
      throw domainError("INVALID_INPUT", error.message);
    }
    return { link };
  });

export const updateTrackingLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; patch: { is_active?: boolean; name?: string; destination?: string } }) => ({
    id: String(d.id),
    patch: d.patch ?? {},
  }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const patch: Record<string, unknown> = {};

    if (typeof data.patch.is_active === "boolean") patch["is_active"] = data.patch.is_active;
    if (typeof data.patch.name === "string") {
      const name = data.patch.name.trim().slice(0, TRACKING_LINK_NAME_MAX);
      if (!name) throw domainError("INVALID_INPUT", "Name is required.");
      patch["name"] = name;
    }
    if (typeof data.patch.destination === "string") {
      const dest = normalizeDestination(data.patch.destination);
      if (!dest.ok) throw domainError("INVALID_INPUT", dest.message);
      patch["destination_path"] = dest.path;
    }
    if (!Object.keys(patch).length) return { ok: true };

    const admin = await getAdmin();
    const { error } = await (admin.from("tracking_links" as never) as any)
      .update(patch)
      .eq("id", data.id);
    if (error) throw domainError("INVALID_INPUT", error.message);
    return { ok: true };
  });

/**
 * Per-link detail for the Growth table: daily trend, locations, referrers.
 * Aggregated in the database; click rows never travel to the browser.
 */
export const getTrackingLinkDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; days?: number | null }) => ({
    id: String(d.id),
    days: d.days == null ? null : Number(d.days),
  }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getAdmin();
    const [daily, locations, referrers] = await Promise.all([
      panel(
        (admin.rpc as any)("tracking_link_daily", { _link_id: data.id, _days: data.days ?? 90 }),
      ),
      panel(
        (admin.rpc as any)("tracking_link_locations", { _link_id: data.id, _days: data.days }),
      ),
      panel(
        (admin.rpc as any)("tracking_link_referrers", { _link_id: data.id, _days: data.days }),
      ),
    ]);
    return { daily, locations, referrers, fetchedAt: new Date().toISOString() };
  });

/**
 * The only write a normal member can trigger: flip their own just-recorded
 * click from guest to member. Requires a session, takes no identity, and can
 * only touch a click id that was handed to this browser seconds ago.
 */
export const markTrackingClickMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { clickId: string }) => ({ clickId: String(d.clickId ?? "") }))
  .handler(async ({ data, context }) => {
    if (!context.userId) return { ok: false };
    if (!/^[0-9a-f-]{36}$/i.test(data.clickId)) return { ok: false };
    const admin = await getAdmin();
    const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { error } = await (admin.from("tracking_link_clicks" as never) as any)
      .update({ visitor_type: "member" })
      .eq("id", data.clickId)
      .eq("visitor_type", "guest")
      .gte("clicked_at", cutoff);
    return { ok: !error };
  });

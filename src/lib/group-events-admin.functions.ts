import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function assertAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Admin only");
}

const baseSchema = z.object({
  group_id: z.string().uuid(),
  title: z.string().min(2).max(120),
  tagline: z.string().max(140).nullable().optional(),
  description: z.string().max(6000).nullable().optional(),
  kind: z.enum(["open_mic", "listening_party", "networking", "screening", "workshop_irl", "online", "other"]),
  format: z.enum(["in_person", "online", "hybrid"]),
  cover_url: z.string().url().nullable().optional(),
  accent_color: z.string().max(20).nullable().optional(),
  starts_at: z.string(),
  ends_at: z.string(),
  timezone: z.string().max(60).default("UTC"),
  venue_name: z.string().max(140).nullable().optional(),
  venue_address: z.string().max(300).nullable().optional(),
  venue_city_id: z.string().uuid().nullable().optional(),
  venue_lat: z.number().nullable().optional(),
  venue_lng: z.number().nullable().optional(),
  online_url: z.string().url().nullable().optional(),
  capacity: z.number().int().min(1).max(10000).nullable().optional(),
  waitlist_enabled: z.boolean().optional(),
  visibility: z.enum(["public", "group_only", "unlisted"]).optional(),
  rsvp_mode: z.enum(["open", "approval", "invite_only"]).optional(),
  promo_pass_months: z.number().int().min(0).max(36).optional(),
  is_official: z.boolean().optional(),
  featured: z.boolean().optional(),
});

export const createEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => baseSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { featured, ...rest } = data;
    const insertRow = {
      ...rest,
      slug: "",
      created_by: userId,
      featured_at: featured ? new Date().toISOString() : null,
      status: "scheduled" as const,
      is_official: data.is_official ?? true,
    };
    const { data: row, error } = await supabase
      .from("group_events")
      .insert(insertRow as never)
      .select("id,slug,group_id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const updateSchema = baseSchema.partial().extend({ id: z.string().uuid() });

export const updateEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => updateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { id, featured, ...rest } = data;
    const patch: Record<string, unknown> = { ...rest };
    if (typeof featured === "boolean") {
      patch.featured_at = featured ? new Date().toISOString() : null;
    }
    const { error } = await supabase.from("group_events").update(patch as never).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), reason: z.string().max(500).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("group_events")
      .update({ status: "canceled" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    // notify rsvps
    const { data: rsvps } = await supabase
      .from("group_event_rsvps")
      .select("user_id")
      .eq("event_id", data.id)
      .in("status", ["going", "maybe", "waitlist"]);
    const { data: ev } = await supabase
      .from("group_events")
      .select("title,slug,group:groups!inner(slug)")
      .eq("id", data.id)
      .maybeSingle();
    if (ev && rsvps && rsvps.length > 0) {
      type EvShape = { title: string; slug: string; group: { slug: string } };
      const e = ev as unknown as EvShape;
      const payload = { event_title: e.title, event_slug: e.slug, group_slug: e.group.slug, reason: data.reason ?? null };
      const rows = rsvps.map((r) => ({
        user_id: r.user_id as string,
        kind: "event_canceled",
        actor_user_id: userId,
        entity_type: "group_event",
        entity_id: data.id,
        payload,
      }));
      await supabase.from("notifications").insert(rows);
    }
    return { ok: true };
  });

export const setEventFeatured = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), featured: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("group_events")
      .update({ featured_at: data.featured ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const postEventUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ event_id: z.string().uuid(), body: z.string().min(1).max(1000) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("group_event_updates")
      .insert({ event_id: data.event_id, body: data.body, created_by: userId });
    if (error) throw new Error(error.message);
    // notify going rsvps
    const { data: rsvps } = await supabase
      .from("group_event_rsvps")
      .select("user_id")
      .eq("event_id", data.event_id)
      .in("status", ["going", "maybe"]);
    const { data: ev } = await supabase
      .from("group_events")
      .select("title,slug,group:groups!inner(slug)")
      .eq("id", data.event_id)
      .maybeSingle();
    if (ev && rsvps && rsvps.length > 0) {
      type EvShape = { title: string; slug: string; group: { slug: string } };
      const e = ev as unknown as EvShape;
      const payload = { event_title: e.title, event_slug: e.slug, group_slug: e.group.slug };
      await supabase.from("notifications").insert(
        rsvps.map((r) => ({
          user_id: r.user_id as string,
          kind: "event_updated",
          actor_user_id: userId,
          entity_type: "group_event",
          entity_id: data.event_id,
          payload,
        })),
      );
    }
    return { ok: true };
  });

export const adminListAllEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("group_events")
      .select("id,slug,title,kind,format,starts_at,status,featured_at,going_count,capacity,promo_pass_months,group:groups!inner(id,slug,name)")
      .is("deleted_at", null)
      .order("starts_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminListGroups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data } = await supabase
      .from("groups")
      .select("id,slug,name,kind")
      .is("deleted_at", null)
      .order("name");
    return data ?? [];
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

const EVENT_FIELDS =
  "id,group_id,slug,title,tagline,description,kind,format,cover_url,accent_color,starts_at,ends_at,timezone,venue_name,venue_address,venue_city_id,venue_lat,venue_lng,online_url,capacity,waitlist_enabled,visibility,rsvp_mode,status,is_official,promo_pass_months,featured_at,going_count,maybe_count,waitlist_count,created_by,created_at,series_key";

export const getEventBySlug = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ groupSlug: z.string(), eventSlug: z.string() }).parse(i))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: row, error } = await supabase
      .from("group_events")
      .select(`${EVENT_FIELDS},group:groups!inner(id,slug,name,avatar_url,kind,accent_color,visibility,deleted_at)`)
      .eq("slug", data.eventSlug)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Event not found");
    const g = (row as { group: { slug: string } }).group;
    if (g.slug !== data.groupSlug) throw new Error("Event not found");
    return row;
  });

export const listFeaturedEvents = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from("group_events")
    .select(`${EVENT_FIELDS},group:groups!inner(slug,name,avatar_url)`)
    .not("featured_at", "is", null)
    .gt("starts_at", new Date().toISOString())
    .is("deleted_at", null)
    .eq("visibility", "public")
    .order("starts_at", { ascending: true })
    .limit(6);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const listGroupEvents = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ groupId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: rows, error } = await supabase
      .from("group_events")
      .select(EVENT_FIELDS)
      .eq("group_id", data.groupId)
      .is("deleted_at", null)
      .order("starts_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listUpcomingForMyGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: mem } = await supabase.from("group_members").select("group_id").eq("user_id", userId);
    const ids = (mem ?? []).map((r) => r.group_id);
    if (ids.length === 0) return [];
    const { data, error } = await supabase
      .from("group_events")
      .select(`${EVENT_FIELDS},group:groups!inner(slug,name,avatar_url)`)
      .in("group_id", ids)
      .gt("starts_at", new Date().toISOString())
      .is("deleted_at", null)
      .order("starts_at", { ascending: true })
      .limit(12);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const rsvpSchema = z.object({
  event_id: z.string().uuid(),
  status: z.enum(["going", "maybe", "declined", "canceled"]),
  plus_ones: z.number().int().min(0).max(2).optional(),
  note: z.string().max(280).nullable().optional(),
});

export const rsvp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => rsvpSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row = {
      event_id: data.event_id,
      user_id: userId,
      status: data.status,
      plus_ones: data.plus_ones ?? 0,
      note: data.note ?? null,
    };
    const { error } = await supabase.from("group_event_rsvps").upsert(row, { onConflict: "event_id,user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyRsvp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ event_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: r } = await supabase
      .from("group_event_rsvps")
      .select("status,plus_ones,note,promo_pass_granted_at")
      .eq("event_id", data.event_id)
      .eq("user_id", userId)
      .maybeSingle();
    return r;
  });

export const listAttendees = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ event_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: rows, error } = await supabase
      .from("group_event_rsvps")
      .select("user_id,status,plus_ones,created_at,profile:profiles(id,username,display_name,avatar_url,event_visibility)")
      .eq("event_id", data.event_id)
      .in("status", ["going", "maybe", "waitlist"])
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listMyUpcomingRsvps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("group_event_rsvps")
      .select(`status,plus_ones,event:group_events!inner(${EVENT_FIELDS},group:groups!inner(slug,name,avatar_url))`)
      .eq("user_id", userId)
      .in("status", ["going", "maybe", "waitlist"])
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    type R = { event: { starts_at: string; ends_at: string } };
    return ((data ?? []) as unknown as R[])
      .filter((r) => new Date(r.event.ends_at) > new Date())
      .sort((a, b) => new Date(a.event.starts_at).getTime() - new Date(b.event.starts_at).getTime());
  });

const commentSchema = z.object({
  event_id: z.string().uuid(),
  body: z.string().min(1).max(500),
  parent_id: z.string().uuid().nullable().optional(),
});

export const postEventComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => commentSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("group_event_comments").insert({
      event_id: data.event_id,
      user_id: userId,
      body: data.body,
      parent_id: data.parent_id ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listEventComments = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ event_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: rows, error } = await supabase
      .from("group_event_comments")
      .select("id,body,parent_id,created_at,user_id,author:profiles(id,username,display_name,avatar_url)")
      .eq("event_id", data.event_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listEventUpdates = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ event_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: rows, error } = await supabase
      .from("group_event_updates")
      .select("id,body,created_at,created_by,author:profiles(id,username,display_name,avatar_url)")
      .eq("event_id", data.event_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

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
  "id,group_id,slug,title,tagline,description,kind,format,cover_url,accent_color,starts_at,ends_at,timezone,venue_name,venue_address,venue_city_id,venue_lat,venue_lng,online_url,capacity,waitlist_enabled,visibility,rsvp_mode,status,published_at,archived_at,is_official,featured_at,going_count,maybe_count,waitlist_count,created_by,created_at,series_key,short_code,lineup_capacity,source,external_url,external_organizer,is_recurring,recurrence_label,pinned_at";

/** The flyer everyone can see. The join link is stripped — it is fetched
 *  separately by confirmed participants via `getEventJoinLink`. */
function toPublicFlyer<T extends { online_url: string | null }>(row: T) {
  const { online_url, ...rest } = row;
  return { ...rest, online_url: null as string | null, has_online_url: Boolean(online_url) };
}

export const getEventBySlug = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ groupSlug: z.string(), eventSlug: z.string() }).parse(i))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: row, error } = await supabase
      .from("group_events")
      .select(`${EVENT_FIELDS},group:groups!group_events_group_id_fkey!inner(id,slug,name,avatar_url,kind,accent_color,visibility,deleted_at)`)
      .eq("slug", data.eventSlug)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Event not found");
    const g = (row as { group: { slug: string } }).group;
    if (g.slug !== data.groupSlug) throw new Error("Event not found");
    return toPublicFlyer(row as typeof row & { online_url: string | null });
  });

/**
 * Same flyer, read as the signed-in viewer. Drafts are only readable by
 * hosts and admins (enforced by RLS), so this is the path a host uses to
 * preview an unpublished Event.
 */
export const getEventBySlugAsViewer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ groupSlug: z.string(), eventSlug: z.string() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("group_events")
      .select(`${EVENT_FIELDS},group:groups!group_events_group_id_fkey!inner(id,slug,name,avatar_url,kind,accent_color,visibility,deleted_at)`)
      .eq("slug", data.eventSlug)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Event not found");
    const g = (row as { group: { slug: string } }).group;
    if (g.slug !== data.groupSlug) throw new Error("Event not found");
    return toPublicFlyer(row as typeof row & { online_url: string | null });
  });



/** Public: upcoming public events that are tied to a city, for the homepage IRL strip. */
export const listCityEventsStrip = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from("group_events")
    .select("id,slug,title,starts_at,city:cities!group_events_venue_city_id_fkey(name,slug),group:groups!group_events_group_id_fkey!inner(slug)")
    .is("deleted_at", null)
    .eq("visibility", "public")
    .not("venue_city_id", "is", null)
    .gt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(8);
  if (error) throw new Error(error.message);
  return data ?? [];
});

/** Public: count of upcoming public events per city. */
export const listCityEventCounts = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from("group_events")
    .select("venue_city_id")
    .is("deleted_at", null)
    .eq("visibility", "public")
    .not("venue_city_id", "is", null)
    .gt("starts_at", new Date().toISOString())
    .limit(1000);
  if (error) throw new Error(error.message);
  const counts: Record<string, number> = {};
  for (const r of data ?? []) {
    const id = (r as { venue_city_id: string | null }).venue_city_id;
    if (id) counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
});

export const listFeaturedEvents = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const nowIso = new Date().toISOString();
  const recentCutoffIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const baseSelect = `${EVENT_FIELDS},group:groups!group_events_group_id_fkey!inner(slug,name,avatar_url)`;
  const publicUndeleted = <T,>(q: T) =>
    (q as any).is("deleted_at", null).eq("visibility", "public") as T;

  // 1) Featured, upcoming.
  const { data: featured, error } = await publicUndeleted(
    supabase
      .from("group_events")
      .select(baseSelect)
      .not("featured_at", "is", null)
      .gt("starts_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(6),
  );
  if (error) throw new Error(error.message);
  if (featured && featured.length > 0) return featured;

  // 2) Any upcoming public event.
  const { data: upcoming, error: upcomingErr } = await publicUndeleted(
    supabase
      .from("group_events")
      .select(baseSelect)
      .gt("starts_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(6),
  );
  if (upcomingErr) throw new Error(upcomingErr.message);
  if (upcoming && upcoming.length > 0) return upcoming;

  // 3) Ongoing — started already but hasn't ended.
  const { data: ongoing, error: ongoingErr } = await publicUndeleted(
    supabase
      .from("group_events")
      .select(baseSelect)
      .lte("starts_at", nowIso)
      .gt("ends_at", nowIso)
      .order("starts_at", { ascending: false })
      .limit(6),
  );
  if (ongoingErr) throw new Error(ongoingErr.message);
  if (ongoing && ongoing.length > 0) return ongoing;

  // 4) Recent past (last 7 days) — covers TBD placeholders and just-ended events.
  const { data: recent, error: recentErr } = await publicUndeleted(
    supabase
      .from("group_events")
      .select(baseSelect)
      .lte("starts_at", nowIso)
      .gt("starts_at", recentCutoffIso)
      .order("starts_at", { ascending: false })
      .limit(6),
  );
  if (recentErr) throw new Error(recentErr.message);
  return recent ?? [];
});



/**
 * Public: the /events feed. Filters run through the shared discovery layer so
 * the feed can never disagree with group tabs, city pages, or the Now board.
 */
export const listPublicEvents = createServerFn({ method: "GET" })
  .inputValidator((i) =>
    z
      .object({
        when: z.enum(["upcoming", "past"]).default("upcoming"),
        format: z.enum(["all", "in_person", "online"]).default("all"),
        cityId: z.string().uuid().nullish(),
        limit: z.number().int().min(1).max(100).default(60),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data }) => {
    const { listDiscoveryEvents } = await import("@/lib/events/discovery.server");
    return listDiscoveryEvents({
      when: data.when,
      format: data.format,
      cityId: data.cityId ?? null,
      limit: data.limit,
    });
  });

export const listGroupEvents = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ groupId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    // Events tagged to this group via event_groups (includes each event's primary group).
    const { data: links, error: linkErr } = await supabase
      .from("event_groups")
      .select("event_id")
      .eq("group_id", data.groupId);
    if (linkErr) throw new Error(linkErr.message);
    const eventIds = (links ?? []).map((l) => l.event_id as string);
    if (eventIds.length === 0) return [];
    const { DISCOVERABLE_STATUSES } = await import("@/lib/events/discovery.server");
    const { data: rows, error } = await supabase
      .from("group_events")
      .select(EVENT_FIELDS)
      .in("id", eventIds)
      .in("status", DISCOVERABLE_STATUSES as never)
      .is("deleted_at", null)
      .order("starts_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listEventGroups = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ event_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: links, error } = await supabase
      .from("event_groups")
      .select("group_id, groups!inner(id,slug,name,avatar_url)")
      .eq("event_id", data.event_id);
    if (error) throw new Error(error.message);
    type Row = { groups: { id: string; slug: string; name: string; avatar_url: string | null } };
    return ((links ?? []) as unknown as Row[]).map((l) => l.groups);
  });


export const listUpcomingForMyGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: mem } = await supabase.from("group_members").select("group_id").eq("user_id", userId);
    const ids = (mem ?? []).map((r) => r.group_id);
    if (ids.length === 0) return [];
    const { DISCOVERABLE_STATUSES, sanitizeDiscoveryRows } = await import(
      "@/lib/events/discovery.server"
    );
    const { data, error } = await supabase
      .from("group_events")
      .select(`${EVENT_FIELDS},group:groups!group_events_group_id_fkey!inner(slug,name,avatar_url,deleted_at)`)
      .in("group_id", ids)
      .in("status", DISCOVERABLE_STATUSES as never)
      .gt("starts_at", new Date().toISOString())
      .is("deleted_at", null)
      .order("starts_at", { ascending: true })
      .limit(12);
    if (error) throw new Error(error.message);
    return sanitizeDiscoveryRows(data) as unknown as NonNullable<typeof data>;
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
    const { requireEventAccess } = await import("@/lib/events/access.server");
    const { event, access } = await requireEventAccess(supabase, data.event_id, userId);
    const attending = data.status === "going" || data.status === "maybe";

    if (attending) {
      if (access.lifecycle === "canceled") throw new Error("This Event was canceled.");
      if (access.lifecycle === "draft") throw new Error("This Event isn't published yet.");
      if (!access.canRsvp) throw new Error("RSVPs are closed for this Event.");
    }

    // Capacity / waitlist is decided here, never by the client.
    let effectiveStatus: string = data.status;
    if (attending) {
      const { capacity, waitlist_enabled } = (await supabase
        .from("group_events")
        .select("capacity,waitlist_enabled")
        .eq("id", data.event_id)
        .maybeSingle()).data as { capacity: number | null; waitlist_enabled: boolean | null } ?? {
        capacity: null,
        waitlist_enabled: false,
      };
      if (capacity && access.rsvpStatus !== "going" && access.rsvpStatus !== "maybe") {
        const { count } = await supabase
          .from("group_event_rsvps")
          .select("user_id", { count: "exact", head: true })
          .eq("event_id", data.event_id)
          .in("status", ["going", "maybe"]);
        if ((count ?? 0) >= capacity) {
          if (!waitlist_enabled) throw new Error("This Event is full.");
          effectiveStatus = "waitlist";
        }
      }
    }

    const row = {
      event_id: data.event_id,
      user_id: userId,
      status: effectiveStatus,
      plus_ones: data.plus_ones ?? 0,
      note: data.note ?? null,
      // Undoing an RSVP relocks participation immediately — including a live
      // check-in. Posts and photos are never deleted.
      ...(attending ? {} : { checked_in_at: null }),
    };
    const { error } = await supabase
      .from("group_event_rsvps")
      .upsert(row as never, { onConflict: "event_id,user_id" });
    if (error) throw new Error(error.message);

    // Auto-join host group when the user is attending. Best-effort —
    // any failure here must not block the RSVP itself.
    if (attending && effectiveStatus !== "waitlist" && event.group_id) {
      await supabase
        .from("group_members")
        .upsert(
          { group_id: event.group_id, user_id: userId, role: "member" },
          { onConflict: "group_id,user_id", ignoreDuplicates: true },
        );
    }

    return { ok: true, status: effectiveStatus };
  });

export const getMyRsvp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ event_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: r } = await supabase
      .from("group_event_rsvps")
      .select("status,plus_ones,note,checked_in_at")
      .eq("event_id", data.event_id)
      .eq("user_id", userId)
      .maybeSingle();
    return r;
  });

/**
 * The join link is never part of the public flyer — only confirmed
 * participants, hosts and admins can read it.
 */
export const getEventJoinLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ event_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<{ online_url: string | null }> => {
    const { supabase, userId } = context;
    const { requireEventAccess } = await import("@/lib/events/access.server");
    const { access } = await requireEventAccess(supabase, data.event_id, userId);
    if (!access.canSeeOnlineUrl) return { online_url: null };
    const { data: row } = await supabase
      .from("group_events")
      .select("online_url")
      .eq("id", data.event_id)
      .maybeSingle();
    return { online_url: (row as { online_url: string | null } | null)?.online_url ?? null };
  });

export const listAttendees = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ event_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: rows, error } = await supabase
      .from("group_event_rsvps")
      .select("user_id,status,plus_ones,created_at")
      .eq("event_id", data.event_id)
      .in("status", ["going", "maybe", "waitlist"])
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    if (ids.length === 0) return [];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id,username,display_name,avatar_url")
      .in("id", ids);
    const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
    return (rows ?? []).map((r) => ({ ...r, profile: pmap.get(r.user_id) ?? null }));
  });

export const listMyUpcomingRsvps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("group_event_rsvps")
      .select(`status,plus_ones,event:group_events!inner(${EVENT_FIELDS},group:groups!group_events_group_id_fkey!inner(slug,name,avatar_url))`)
      .eq("user_id", userId)
      .in("status", ["going", "maybe", "waitlist"])
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    type R = { event: { starts_at: string; ends_at: string } };
    return ((data ?? []) as unknown as R[])
      .filter((r) => new Date(r.event.ends_at) > new Date())
      .sort((a, b) => new Date(a.event.starts_at).getTime() - new Date(b.event.starts_at).getTime());
  });

export const listMyPastRsvps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("group_event_rsvps")
      .select(`status,plus_ones,event:group_events!inner(${EVENT_FIELDS},group:groups!group_events_group_id_fkey!inner(slug,name,avatar_url))`)
      .eq("user_id", userId)
      .in("status", ["going", "maybe", "waitlist"])
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    type R = { event: { starts_at: string; ends_at: string } };
    return ((data ?? []) as unknown as R[])
      .filter((r) => new Date(r.event.ends_at) <= new Date())
      .sort((a, b) => new Date(b.event.starts_at).getTime() - new Date(a.event.starts_at).getTime())
      .slice(0, 30);
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
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ event_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("group_event_comments")
      .select("id,body,parent_id,created_at,user_id,system_kind")
      .eq("event_id", data.event_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return [];

    const commentIds = rows.map((r) => r.id);
    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));

    const [profilesRes, reactionsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url")
        .in("id", userIds),
      supabase
        .from("group_event_comment_reactions")
        .select("comment_id,user_id,kind")
        .in("comment_id", commentIds)
        .eq("kind", "like"),
    ]);
    const pmap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
    const likeCount = new Map<string, number>();
    const likedByMe = new Set<string>();
    for (const r of reactionsRes.data ?? []) {
      likeCount.set(r.comment_id, (likeCount.get(r.comment_id) ?? 0) + 1);
      if (r.user_id === userId) likedByMe.add(r.comment_id);
    }
    return rows.map((r) => ({
      ...r,
      author: pmap.get(r.user_id) ?? null,
      like_count: likeCount.get(r.id) ?? 0,
      liked_by_me: likedByMe.has(r.id),
    }));
  });

export const toggleEventCommentLike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ comment_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("group_event_comment_reactions")
      .select("id")
      .eq("comment_id", data.comment_id)
      .eq("user_id", userId)
      .eq("kind", "like")
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("group_event_comment_reactions")
        .delete()
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { liked: false };
    }
    const { error } = await supabase
      .from("group_event_comment_reactions")
      .insert({ comment_id: data.comment_id, user_id: userId, kind: "like" });
    if (error) throw new Error(error.message);
    return { liked: true };
  });


export const listEventUpdates = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ event_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: rows, error } = await supabase
      .from("group_event_updates")
      .select("id,body,created_at,created_by")
      .eq("event_id", data.event_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r) => r.created_by)));
    if (ids.length === 0) return [];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id,username,display_name,avatar_url")
      .in("id", ids);
    const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
    return (rows ?? []).map((r) => ({ ...r, author: pmap.get(r.created_by) ?? null }));
  });

// --- Attendee activity surface (collabs & works of RSVPs, public) ---

async function attendeeUserIds(eventId: string): Promise<string[]> {
  const supabase = publicClient();
  const { data: rsvps } = await supabase
    .from("group_event_rsvps")
    .select("user_id")
    .eq("event_id", eventId)
    .in("status", ["going", "maybe", "waitlist"])
    .limit(500);
  const ids = Array.from(new Set((rsvps ?? []).map((r) => r.user_id)));
  if (ids.length === 0) return [];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,discoverable")
    .in("id", ids)
    .eq("discoverable", true);
  return (profiles ?? []).map((p) => p.id);
}

const POOL_SIZE = 300;

type Attendee = { display_name: string | null; username: string | null; avatar_url: string | null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

function bucketAndFair(
  rows: AnyRow[],
  ownerKey: string,
  attendeeKey: string,
  perUserCap: number,
  fairSize: number,
) {
  // Bucket by owner, preserve incoming order (already recency-sorted).
  const buckets = new Map<string, { user: Attendee | null; items: AnyRow[]; total: number }>();
  for (const r of rows) {
    const uid = r[ownerKey] as string | null;
    if (!uid) continue;
    let b = buckets.get(uid);
    if (!b) {
      b = { user: (r[attendeeKey] as Attendee | null) ?? null, items: [], total: 0 };
      buckets.set(uid, b);
    }
    b.total += 1;
    if (b.items.length < perUserCap) b.items.push(r);
  }
  // Ordered by most-recent activity (first appearance of user in `rows`).
  const ordered = Array.from(buckets.entries()).map(([uid, b]) => ({
    uid,
    user: b.user,
    items: b.items,
    remaining: Math.max(0, b.total - b.items.length),
  }));
  // Round-robin fair list: one item per user per pass.
  const fair: AnyRow[] = [];
  let pass = 0;
  while (fair.length < fairSize) {
    let added = false;
    for (const g of ordered) {
      if (pass < g.items.length) {
        fair.push(g.items[pass]);
        added = true;
        if (fair.length >= fairSize) break;
      }
    }
    if (!added) break;
    pass += 1;
  }
  return { fair, byPerson: ordered, totalAttendees: ordered.length };
}

export const listEventAttendeeCollabs = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({
      event_id: z.string().uuid(),
      mode: z.enum(["fair", "byPerson"]).optional(),
      perUserCap: z.number().int().min(1).max(6).optional(),
      fairSize: z.number().int().min(1).max(48).optional(),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const ids = await attendeeUserIds(data.event_id);
    if (ids.length === 0) return { fair: [], byPerson: [], totalAttendees: 0, totalItems: 0 };
    const supabase = publicClient();
    const mode = data.mode ?? "fair";
    const perUserCap = data.perUserCap ?? (mode === "byPerson" ? 3 : 2);
    const fairSize = data.fairSize ?? 12;
    const select = "id,user_id,title,slug,category,description,timeline_text,timeline_mode,starts_on,ends_on,location_mode,compensation_type,status,created_at,resulting_work_id, user:profiles!collab_posts_user_id_fkey(id,display_name,username,avatar_url), city:cities!collab_posts_city_id_fkey(name), roles:collab_roles(id,role_name,sort_order)";
    const { data: rows, error } = await supabase
      .from("collab_posts")
      .select(select)
      .in("user_id", ids)
      .or("status.eq.open,and(status.eq.closed,resulting_work_id.not.is.null)")
      .order("created_at", { ascending: false })
      .limit(POOL_SIZE);
    if (error) throw new Error(error.message);
    const pool = (rows ?? []) as unknown as Record<string, unknown>[];
    const { fair, byPerson, totalAttendees } = bucketAndFair(pool, "user_id", "user", perUserCap, fairSize);
    return { fair, byPerson, totalAttendees, totalItems: pool.length };
  });

export const listEventAttendeeWorks = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({
      event_id: z.string().uuid(),
      mode: z.enum(["fair", "byPerson"]).optional(),
      perUserCap: z.number().int().min(1).max(12).optional(),
      fairSize: z.number().int().min(1).max(48).optional(),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const ids = await attendeeUserIds(data.event_id);
    if (ids.length === 0) return { fair: [], byPerson: [], totalAttendees: 0, totalItems: 0 };
    const supabase = publicClient();
    const mode = data.mode ?? "fair";
    const perUserCap = data.perUserCap ?? (mode === "byPerson" ? 6 : 3);
    const fairSize = data.fairSize ?? 12;
    const select = "id,title,slug,category,cover_url,embed_url,source_type,like_count,save_count,view_count,published_at,created_by, work_credits(role_label, sort_order, display_name, profiles(id,display_name,username,avatar_url)), author:profiles!works_created_by_fkey(id,display_name,username,avatar_url)";
    const { data: rows, error } = await supabase
      .from("works")
      .select(select)
      .in("created_by", ids)
      .eq("status", "published")
      .eq("visibility", "public")
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(POOL_SIZE);
    if (error) throw new Error(error.message);
    const pool = (rows ?? []) as unknown as Record<string, unknown>[];
    const { fair, byPerson, totalAttendees } = bucketAndFair(pool, "created_by", "author", perUserCap, fairSize);
    return { fair, byPerson, totalAttendees, totalItems: pool.length };
  });


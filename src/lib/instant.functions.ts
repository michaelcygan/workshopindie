import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MEDIUMS = ["film", "music", "writing", "writing_book", "build", "visual", "critique", "business", "coworking", "office_hours", "roundtable", "pitch", "listen_party", "open_mic", "jam", "standup"] as const;
const mediumSchema = z.enum(MEDIUMS);
const VISIBILITIES = ["open", "mutuals", "invite"] as const;
const visibilitySchema = z.enum(VISIBILITIES);
export type RoomVisibility = (typeof VISIBILITIES)[number];

/**
 * Notify mutual followers that a host just opened a live Workshop. Best-effort:
 * never throws into the host's create flow. Skips when visibility = 'invite',
 * and rate-limits to one notification batch per host per 30 minutes.
 */
async function notifyMutualsOnHost(opts: {
  hostUserId: string;
  roomId: string;
  visibility: RoomVisibility;
  medium: (typeof MEDIUMS)[number] | null;
  title: string;
}) {
  try {
    if (opts.visibility === "invite") return;

    // Rate-limit: don't spam if the same host opened a room recently.
    const { data: allowed } = await supabaseAdmin.rpc("check_and_bump", {
      _action: "workshop_live_notify",
      _key: opts.hostUserId,
      _window_s: 1800,
      _max: 1,
    });
    if (allowed === false) return;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, username")
      .eq("id", opts.hostUserId)
      .maybeSingle();
    const actorName = (profile as any)?.display_name || (profile as any)?.username || "Someone";
    const actorUsername = (profile as any)?.username ?? null;

    // Mutual follows: I follow them AND they follow me back.
    const { data: outgoing } = await supabaseAdmin
      .from("follows")
      .select("followed_user_id")
      .eq("follower_user_id", opts.hostUserId);
    const outgoingIds = (outgoing ?? []).map((r: any) => r.followed_user_id as string);
    if (outgoingIds.length === 0) return;
    const { data: incoming } = await supabaseAdmin
      .from("follows")
      .select("follower_user_id")
      .eq("followed_user_id", opts.hostUserId)
      .in("follower_user_id", outgoingIds);
    const mutuals = (incoming ?? []).map((r: any) => r.follower_user_id as string);
    if (mutuals.length === 0) return;

    // Respect prefs (inapp_workshop_updates). Anyone with no prefs row defaults to true.
    const { data: prefs } = await supabaseAdmin
      .from("notification_preferences")
      .select("user_id, inapp_workshop_updates")
      .in("user_id", mutuals);
    const optedOut = new Set(
      (prefs ?? [])
        .filter((p: any) => p.inapp_workshop_updates === false)
        .map((p: any) => p.user_id as string),
    );
    const recipients = mutuals.filter((id) => !optedOut.has(id));
    if (recipients.length === 0) return;

    const rows = recipients.map((uid) => ({
      user_id: uid,
      kind: "workshop_live",
      actor_user_id: opts.hostUserId,
      entity_type: "instant_room",
      entity_id: opts.roomId,
      payload: {
        actor_name: actorName,
        actor_username: actorUsername,
        room_id: opts.roomId,
        title: opts.title,
        medium: opts.medium,
        visibility: opts.visibility,
      },
    }));
    await supabaseAdmin.from("notifications").insert(rows);
  } catch {
    // best effort; never block the host flow
  }
}

/**
 * Start a brand-new live Workshop owned by the caller as host.
 * Distinct from `joinLounge` (matchmaker) — this room always belongs to
 * the caller, gets a "Host" badge, and the caller can later "Create a Collab"
 * from it to turn it into a persistent Workshop.
 */
export const hostInstantWorkshop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    medium?: (typeof MEDIUMS)[number] | null;
    title?: string | null;
    visibility?: RoomVisibility;
  } | undefined) =>
    z.object({
      medium: mediumSchema.nullish(),
      title: z.string().trim().min(1).max(120).nullish(),
      visibility: visibilitySchema.default("open"),
    }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, username")
      .eq("id", userId)
      .maybeSingle();
    const name = profile?.display_name || profile?.username || "Host";
    const title = data.title?.trim() || `${name}'s Workshop`;
    const { data: room, error } = await supabaseAdmin
      .from("instant_rooms")
      .insert({
        kind: "lounge",
        title,
        status: "active",
        participant_cap: 5,
        creator_id: userId,
        host_user_id: userId,
        medium: data.medium ?? null,
        visibility: data.visibility,
      } as any)
      .select("id")
      .single();
    if (error || !room) throw new Error(error?.message ?? "Couldn't open your Workshop");

    // Fire-and-forget mutual notification (also surfaces a soft viral loop).
    await notifyMutualsOnHost({
      hostUserId: userId,
      roomId: room.id as string,
      visibility: data.visibility,
      medium: data.medium ?? null,
      title,
    });

    return { roomId: room.id };
  });

/** Public: fetch a single instant room's metadata (for headers, banners, etc). */
export const getInstantRoom = createServerFn({ method: "GET" })
  .inputValidator((input: { roomId: string }) =>
    z.object({ roomId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: room } = await supabaseAdmin
      .from("instant_rooms")
      .select("id, title, kind, medium, host_user_id, promoted_at, source_workshop_id, status, focus_message, locked, ended_by_user_id")
      .eq("id", data.roomId)
      .maybeSingle();
    return { room };
  });

/**
 * Matchmaker: drop the user into the fullest active OPEN-visibility Lounge
 * with a seat, preferring rooms hosted by people the viewer follows. Skips
 * rooms that contain anyone the viewer has blocked (or who blocked them),
 * plus any rooms passed in `excludeRoomIds` (used by Hop and the client-side
 * 5-minute "don't ping-pong back" skip list).
 */
export const joinLounge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { excludeRoomIds?: string[] } | undefined) =>
    z.object({ excludeRoomIds: z.array(z.string().uuid()).max(20).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: roomId, error } = await supabaseAdmin.rpc("join_lounge", {
      _user_id: userId,
      _exclude_room_ids: data.excludeRoomIds ?? [],
    } as any);
    if (error) throw new Error(error.message);
    return { roomId: roomId as string };
  });

/**
 * Host-only: notify the host's mutual followers that this room is live.
 * Rate-limited (one batch per 30 min) via the same helper as auto-notify on host.
 */
export const pingMutualsForRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string }) =>
    z.object({ roomId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: room } = await supabaseAdmin
      .from("instant_rooms")
      .select("id, kind, status, host_user_id, medium, title, visibility")
      .eq("id", data.roomId)
      .maybeSingle();
    if (!room) throw new Error("Room not found");
    if ((room as any).host_user_id !== userId) throw new Error("Only the host can ping mutuals");
    if (room.kind !== "lounge" || room.status !== "active") throw new Error("Room isn't live");
    const visibility = ((room as any).visibility ?? "open") as RoomVisibility;
    if (visibility === "invite") return { notified: 0 };

    const before = Date.now();
    await notifyMutualsOnHost({
      hostUserId: userId,
      roomId: room.id as string,
      visibility,
      medium: ((room as any).medium ?? null) as (typeof MEDIUMS)[number] | null,
      title: (room as any).title ?? "Workshop",
    });
    const sinceIso = new Date(before - 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("actor_user_id", userId)
      .eq("kind", "workshop_live")
      .eq("entity_id", room.id as string)
      .gte("created_at", sinceIso);
    return { notified: count ?? 0 };
  });

/** Join a specific live room by id. Rejects if the room is full or no longer active. */
export const joinSpecificInstantRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string }) =>
    z.object({ roomId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: room } = await supabaseAdmin
      .from("instant_rooms")
      .select("id, kind, status, participant_cap, locked, host_user_id")
      .eq("id", data.roomId)
      .maybeSingle();
    if (!room) throw new Error("That room no longer exists");
    if (room.kind !== "lounge" || room.status !== "active") {
      throw new Error("That room isn't live anymore");
    }
    // Locked rooms reject new joiners (host can still rejoin).
    if ((room as any).locked && (room as any).host_user_id !== userId) {
      throw new Error("This Workshop is locked. Ask the host for a link.");
    }
    // Recently removed users can't rejoin until their cooldown expires.
    const { data: rm } = await supabaseAdmin
      .from("instant_room_removals")
      .select("until")
      .eq("room_id", data.roomId)
      .eq("user_id", userId)
      .maybeSingle();
    if (rm && new Date((rm as any).until).getTime() > Date.now()) {
      throw new Error("You were removed from this Workshop. Try again later.");
    }
    const cap = (room as any).participant_cap ?? 5;
    const cutoff = new Date(Date.now() - 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("instant_presence")
      .select("user_id", { count: "exact", head: true })
      .eq("room_id", data.roomId)
      .gt("last_seen_at", cutoff);
    if ((count ?? 0) >= cap) throw new Error("Room is full");
    return { roomId: data.roomId };
  });

/** Matchmaker for medium-specific Instant Workshops (Film, Music, Writing, Build, Visual). */
export const joinMediumLounge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { medium: (typeof MEDIUMS)[number]; excludeRoomIds?: string[] }) =>
    z.object({
      medium: mediumSchema,
      excludeRoomIds: z.array(z.string().uuid()).max(20).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: roomId, error } = await supabaseAdmin.rpc("join_medium_lounge", {
      _user_id: userId,
      _medium: data.medium,
      _exclude_room_ids: data.excludeRoomIds ?? [],
    } as any);
    if (error) throw new Error(error.message);
    return { roomId: roomId as string, medium: data.medium };
  });

export type RoomPresenceUser = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export type ActiveInstantRoom = {
  id: string;
  medium: (typeof MEDIUMS)[number] | null;
  title: string;
  live_count: number;
  created_at: string;
  participants: RoomPresenceUser[];
};

/**
 * Public list of currently-active Instant rooms (lounges + medium-specific) with
 * live counts and top participants. Scoped by viewer so mutuals-only rooms are
 * filtered to mutual follows of the host.
 */
export const listActiveInstantRooms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data, error } = await supabaseAdmin.rpc("list_active_instant_rooms", { _viewer: userId });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Omit<ActiveInstantRoom, "participants">[];
    if (rows.length === 0) return { rooms: [] as ActiveInstantRoom[] };

    const roomIds = rows.map((r) => r.id);
    const cutoff = new Date(Date.now() - 60_000).toISOString();
    const { data: presence } = await supabaseAdmin
      .from("instant_presence")
      .select("room_id, user_id, last_seen_at")
      .in("room_id", roomIds)
      .gt("last_seen_at", cutoff)
      .order("last_seen_at", { ascending: false });

    const userIds = Array.from(new Set((presence ?? []).map((p) => p.user_id)));
    const profilesById = new Map<string, RoomPresenceUser>();
    if (userIds.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .in("id", userIds);
      for (const p of profs ?? []) {
        profilesById.set(p.id as string, {
          user_id: p.id as string,
          display_name: (p as any).display_name ?? null,
          username: (p as any).username ?? null,
          avatar_url: (p as any).avatar_url ?? null,
        });
      }
    }

    const byRoom = new Map<string, RoomPresenceUser[]>();
    for (const p of presence ?? []) {
      const prof = profilesById.get(p.user_id as string);
      if (!prof) continue;
      const list = byRoom.get(p.room_id as string) ?? [];
      if (list.length < 5) list.push(prof);
      byRoom.set(p.room_id as string, list);
    }

    return {
      rooms: rows.map((r) => ({ ...r, participants: byRoom.get(r.id) ?? [] })) as ActiveInstantRoom[],
    };
  });

export type InstantActivityEvent = {
  id: string;
  kind: "join" | "spawn" | "end";
  medium: (typeof MEDIUMS)[number] | null;
  title: string;
  actor_display_name: string | null;
  created_at: string;
};

/** Public recent activity feed for the ticker. */
export const listRecentActivity = createServerFn({ method: "GET" })
  .inputValidator((input: { limit?: number } | undefined) =>
    z.object({ limit: z.number().int().min(1).max(50).default(20) }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("instant_activity")
      .select("id, kind, medium, title, actor_display_name, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { events: (rows ?? []) as InstantActivityEvent[] };
  });

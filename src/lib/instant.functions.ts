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
    const providedTitle = data.title?.trim() || null;
    // v1: "namer" model. If the opener names the Lounge, they claim it
    // (stored on host_user_id — no in-room privileges beyond rename/end).
    // If no name, the Lounge is unnamed and any participant can name it first.
    const title = providedTitle || `${name}'s Lounge`;
    const namedByUserId = providedTitle ? userId : null;
    const { data: room, error } = await supabaseAdmin
      .from("instant_rooms")
      .insert({
        kind: "lounge",
        title,
        status: "active",
        participant_cap: 5,
        creator_id: userId,
        host_user_id: namedByUserId,
        medium: data.medium ?? null,
        visibility: data.visibility,
      } as any)
      .select("id")
      .single();
    if (error || !room) throw new Error(error?.message ?? "Couldn't open your Lounge");

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

/**
 * Rename a Lounge. First person to name an unnamed Lounge becomes the
 * "namer" and is the only one who can rename or end it thereafter.
 * For group-scoped Lounges, only group members can claim the name.
 */
export const renameLounge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; title: string }) =>
    z.object({
      roomId: z.string().uuid(),
      title: z.string().trim().min(1).max(80),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: room } = await supabaseAdmin
      .from("instant_rooms")
      .select("id, kind, status, host_user_id, group_id")
      .eq("id", data.roomId)
      .maybeSingle();
    if (!room) throw new Error("Room not found");
    if ((room as any).kind !== "lounge" || (room as any).status !== "active") {
      throw new Error("This Lounge isn't live");
    }

    const currentNamer = (room as any).host_user_id as string | null;
    if (currentNamer && currentNamer !== userId) {
      throw new Error("Only the person who named this Lounge can rename it.");
    }

    // Group-scoped Lounge: only members may name it.
    const groupId = (room as any).group_id as string | null;
    if (groupId) {
      const { data: mem } = await supabaseAdmin
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!mem) throw new Error("Only group members can name this Lounge.");
    }

    const nextTitle = data.title.trim();
    const update: Record<string, unknown> = { title: nextTitle };
    if (!currentNamer) update.host_user_id = userId;

    const { error } = await supabaseAdmin
      .from("instant_rooms")
      .update(update as any)
      .eq("id", data.roomId);
    if (error) throw new Error(error.message);
    return { ok: true, title: nextTitle, namedByUserId: currentNamer ?? userId };
  });

/**
 * End a Lounge. Only the namer (the person who named it) can end it.
 */
export const endLounge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string }) =>
    z.object({ roomId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: room } = await supabaseAdmin
      .from("instant_rooms")
      .select("id, kind, status, host_user_id")
      .eq("id", data.roomId)
      .maybeSingle();
    if (!room) throw new Error("Room not found");
    if ((room as any).host_user_id !== userId) {
      throw new Error("Only the person who named this Lounge can end it.");
    }
    if ((room as any).status !== "active") return { ok: true };
    const { error } = await supabaseAdmin
      .from("instant_rooms")
      .update({ status: "ended", ended_by_user_id: userId } as any)
      .eq("id", data.roomId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Public: fetch a single instant room's metadata (for headers, banners, etc). */
export const getInstantRoom = createServerFn({ method: "GET" })
  .inputValidator((input: { roomId: string }) =>
    z.object({ roomId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: room } = await supabaseAdmin
      .from("instant_rooms")
      .select("id, title, kind, medium, category, host_user_id, promoted_at, source_workshop_id, status, focus_message, locked, ended_by_user_id, workshop_id, claim_user_id, claim_started_at, claim_vetoed")
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

/**
 * Find-or-create the persistent Lounge attached to a Group, auto-join the
 * caller as a group member (no separate "Join Group" tap required), and
 * return the room id so the client can navigate into /lounge/$id.
 *
 * Group Lounges are public to any signed-in user — anyone who walks in
 * gets added to the group as a side-effect. Visibility on the room is
 * "open" so the matchmaker can also surface it.
 */
export const joinGroupLounge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string }) =>
    z.object({ groupId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: group } = await supabaseAdmin
      .from("groups")
      .select("id, name, slug")
      .eq("id", data.groupId)
      .maybeSingle();
    if (!group) throw new Error("Group not found");

    // Auto-join as a member. Ignore duplicate-key violations — already in.
    const { error: memberErr } = await supabaseAdmin
      .from("group_members")
      .insert({ group_id: data.groupId, user_id: userId } as any);
    if (memberErr && !/duplicate|unique/i.test(memberErr.message)) {
      // Non-fatal: we still want them in the room. Log via throw only if
      // membership itself is required by RLS — for v1 the lounge is open.
    }

    // Find an active room already attached to this group.
    const { data: existing } = await supabaseAdmin
      .from("instant_rooms")
      .select("id")
      .eq("group_id", data.groupId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.id) return { roomId: existing.id as string };

    const { data: room, error } = await supabaseAdmin
      .from("instant_rooms")
      .insert({
        kind: "lounge",
        title: `${(group as any).name} · Lounge`,
        status: "active",
        participant_cap: 5,
        creator_id: userId,
        host_user_id: null,
        group_id: data.groupId,
        visibility: "open",
      } as any)
      .select("id")
      .single();
    if (error || !room) throw new Error(error?.message ?? "Couldn't open the Lounge");
    return { roomId: room.id as string };
  });

// joinCollabLounge retired in v1 — Lounges are no longer scoped to Collab posts.
// Existing rooms with a `collab_id` still work if someone has the /lounge/$id link,
// but new Collab-scoped Lounges can no longer be created.


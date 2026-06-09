import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MEDIUMS = ["film", "music", "writing", "build", "visual", "critique", "business", "coworking"] as const;
const mediumSchema = z.enum(MEDIUMS);

/**
 * Spin up a brand-new live Workshop room owned by the caller as host.
 * Distinct from `joinLounge` (matchmaker) — this room always belongs to
 * the caller, gets a "Host" badge, and the caller can later "Create a Collab"
 * from it to turn it into a persistent Workshop.
 */
export const hostInstantWorkshop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { medium?: (typeof MEDIUMS)[number] | null; title?: string | null } | undefined) =>
    z.object({
      medium: mediumSchema.nullish(),
      title: z.string().trim().min(1).max(120).nullish(),
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
      })
      .select("id")
      .single();
    if (error || !room) throw new Error(error?.message ?? "Couldn't open your Workshop");
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
      .select("id, title, kind, medium, host_user_id, promoted_at, source_workshop_id, status")
      .eq("id", data.roomId)
      .maybeSingle();
    return { room };
  });

/**
 * Matchmaker: drop the user into the fullest active Lounge that still has
 * room (cap 5), or spin up a brand-new Lounge if none has space.
 */
export const joinLounge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data, error } = await supabaseAdmin.rpc("join_lounge", { _user_id: userId });
    if (error) throw new Error(error.message);
    return { roomId: data as string };
  });

/** Join a specific live room by id. Rejects if the room is full or no longer active. */
export const joinSpecificInstantRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string }) =>
    z.object({ roomId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: room } = await supabaseAdmin
      .from("instant_rooms")
      .select("id, kind, status, participant_cap")
      .eq("id", data.roomId)
      .maybeSingle();
    if (!room) throw new Error("That room no longer exists");
    if (room.kind !== "lounge" || room.status !== "active") {
      throw new Error("That room isn't live anymore");
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
  .inputValidator((input: { medium: (typeof MEDIUMS)[number] }) =>
    z.object({ medium: mediumSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: roomId, error } = await supabaseAdmin.rpc("join_medium_lounge", {
      _user_id: userId,
      _medium: data.medium,
    });
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

/** Public list of currently-active Instant rooms (lounges + medium-specific) with live counts and top participants. */
export const listActiveInstantRooms = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin.rpc("list_active_instant_rooms");
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

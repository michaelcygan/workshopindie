import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ONLINE_WINDOW_MS = 2 * 60 * 1000;

export type Friend = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  headline: string | null;
  online: boolean;
  last_active_at: string | null;
};

export type LiveLoungeRoom = {
  id: string;
  title: string;
  medium: string | null;
  groupName: string | null;
  groupSlug: string | null;
  createdAt: string;
};

const COME_ONLINE_THRESHOLD_MS = 10 * 60 * 1000;

/**
 * Lightweight presence heartbeat. Touches profiles.last_active_at for the
 * signed-in user. Called every ~60s from the root while the tab is visible.
 *
 * Also fires "friend came online" notifications to mutuals who opted in,
 * but only when the user has been away for >10 minutes — so the per-minute
 * heartbeat doesn't spam anyone.
 */
export const pingPresence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    const { data: prev } = await supabaseAdmin
      .from("profiles")
      .select("last_active_at, show_online, display_name, username")
      .eq("id", userId)
      .maybeSingle();

    const now = new Date();
    await supabaseAdmin
      .from("profiles")
      .update({ last_active_at: now.toISOString() })
      .eq("id", userId);

    const wasAway =
      !prev?.last_active_at ||
      now.getTime() - new Date(prev.last_active_at).getTime() > COME_ONLINE_THRESHOLD_MS;
    if (!wasAway || !prev?.show_online) return { ok: true, cameOnline: false };

    // Find mutuals
    const [{ data: iFollow }, { data: followMe }] = await Promise.all([
      supabaseAdmin.from("follows").select("followed_user_id").eq("follower_user_id", userId),
      supabaseAdmin.from("follows").select("follower_user_id").eq("followed_user_id", userId),
    ]);
    const iFollowSet = new Set((iFollow ?? []).map((r) => r.followed_user_id));
    const mutualIds = (followMe ?? [])
      .map((r) => r.follower_user_id)
      .filter((id) => iFollowSet.has(id));
    if (mutualIds.length === 0) return { ok: true, cameOnline: true };

    // "Came online" is opt-IN (default off), so the opt-in list is resolved
    // here; self-suppression, blocks and dedupe come from the delivery service.
    const { data: prefs } = await supabaseAdmin
      .from("notification_preferences")
      .select("user_id, inapp_friend_online")
      .in("user_id", mutualIds)
      .eq("inapp_friend_online", true);
    const optedIn = (prefs ?? []).map((p) => p.user_id as string);
    if (optedIn.length === 0) return { ok: true, cameOnline: true };

    const { notifyMany } = await import("@/lib/notifications/deliver.server");
    await notifyMany({
      recipientIds: optedIn,
      actorUserId: userId,
      kind: "friend_online",
      entityType: "profile",
      entityId: userId,
      dedupeWindowS: 300,
      payload: { display_name: prev.display_name, username: prev.username },
    });


    return { ok: true, cameOnline: true };
  });

/**
 * Mutual-follow friends list with online indicator.
 * Online = last_active_at within 2 minutes AND show_online=true.
 */
export const getFriends = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Friend[]> => {
    const { userId } = context;
    const [{ data: iFollow }, { data: followMe }, { data: blocksMine }, { data: blocksOnMe }] = await Promise.all([
      supabaseAdmin.from("follows").select("followed_user_id").eq("follower_user_id", userId),
      supabaseAdmin.from("follows").select("follower_user_id").eq("followed_user_id", userId),
      supabaseAdmin.from("user_blocks").select("blocked_user_id").eq("blocker_user_id", userId),
      supabaseAdmin.from("user_blocks").select("blocker_user_id").eq("blocked_user_id", userId),
    ]);
    const iFollowSet = new Set((iFollow ?? []).map((r) => r.followed_user_id));
    const blocked = new Set<string>([
      ...(blocksMine ?? []).map((r) => r.blocked_user_id),
      ...(blocksOnMe ?? []).map((r) => r.blocker_user_id),
    ]);
    const mutualIds = (followMe ?? [])
      .map((r) => r.follower_user_id)
      .filter((id) => iFollowSet.has(id) && !blocked.has(id));
    if (mutualIds.length === 0) return [];

    const { data: rows } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, username, avatar_url, headline, last_active_at, show_online")
      .in("id", mutualIds)
      .limit(200);

    const now = Date.now();
    return (rows ?? [])
      .map((p) => {
        const last = p.last_active_at ? new Date(p.last_active_at).getTime() : 0;
        const isOnline = !!p.show_online && last > 0 && now - last < ONLINE_WINDOW_MS;
        return {
          user_id: p.id,
          display_name: p.display_name,
          username: p.username,
          avatar_url: p.avatar_url,
          headline: p.headline,
          online: isOnline,
          last_active_at: p.show_online ? p.last_active_at : null,
        } as Friend;
      })
      .sort((a, b) => {
        if (a.online !== b.online) return a.online ? -1 : 1;
        return (a.display_name ?? a.username ?? "").localeCompare(
          b.display_name ?? b.username ?? "",
        );
      });
  });

/**
 * Live Lounge rooms the signed-in user can invite someone into: rooms they
 * created, or rooms they're currently present in. Used by the invite picker.
 */
export const listMyLoungeRooms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LiveLoungeRoom[]> => {
    const { userId } = context;
    const liveCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const [{ data: presence }, { data: mine }] = await Promise.all([
      supabaseAdmin
        .from("instant_presence")
        .select("room_id")
        .eq("user_id", userId)
        .gt("last_seen_at", liveCutoff),
      supabaseAdmin
        .from("instant_rooms")
        .select("id")
        .eq("creator_id", userId)
        .eq("status", "active")
        .limit(30),
    ]);

    const ids = [
      ...new Set([
        ...(presence ?? []).map((p) => p.room_id as string),
        ...(mine ?? []).map((r) => r.id as string),
      ]),
    ];
    if (ids.length === 0) return [];

    const { data: rooms } = await supabaseAdmin
      .from("instant_rooms")
      .select("id,title,medium,group_id,status,created_at,groups:groups(name,slug)")
      .in("id", ids)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(20);

    return (rooms ?? []).map((r) => ({
      id: r.id as string,
      title: (r.title as string | null) ?? "Group audio",
      medium: (r.medium as string | null) ?? null,
      groupName:
        ((r as unknown as { groups: { name: string } | null }).groups?.name ?? null) as
          | string
          | null,
      groupSlug:
        ((r as unknown as { groups: { slug: string } | null }).groups?.slug ?? null) as
          | string
          | null,
      createdAt: r.created_at as string,
    }));
  });

/**
 * Invite a mutual follow into one specific live Lounge room.
 * Idempotent — lounge_invitations is unique on (room_id, invitee_user_id).
 */
export const inviteFriendToLounge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        roomId: z.string().uuid(),
        inviteeId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (data.inviteeId === userId) throw new Error("Pick someone other than yourself.");

    const { data: room } = await supabaseAdmin
      .from("instant_rooms")
      .select("id,title,medium,status,group_id,groups:groups(slug)")
      .eq("id", data.roomId)
      .maybeSingle();
    if (!room || room.status !== "active") throw new Error("That Group audio is no longer live.");
    const groupSlug = (room as unknown as { groups?: { slug: string } | null }).groups?.slug ?? null;

    // Require mutual follow.
    const [{ data: a }, { data: b }] = await Promise.all([
      supabaseAdmin
        .from("follows")
        .select("follower_user_id")
        .eq("follower_user_id", userId)
        .eq("followed_user_id", data.inviteeId)
        .maybeSingle(),
      supabaseAdmin
        .from("follows")
        .select("follower_user_id")
        .eq("follower_user_id", data.inviteeId)
        .eq("followed_user_id", userId)
        .maybeSingle(),
    ]);
    if (!a || !b) throw new Error("You can only invite mutual follows.");

    await supabaseAdmin
      .from("lounge_invitations")
      .upsert(
        {
          room_id: room.id,
          invitee_user_id: data.inviteeId,
          inviter_user_id: userId,
          status: "pending",
          expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        },
        { onConflict: "room_id,invitee_user_id" },
      )
      .then(() => null, () => null);

    const { data: inviter } = await supabaseAdmin
      .from("profiles")
      .select("display_name,username")
      .eq("id", userId)
      .maybeSingle();
    const inviterName =
      (inviter?.display_name as string | null) ?? (inviter?.username as string | null) ?? null;

    const { notify } = await import("@/lib/notifications/deliver.server");
    await notify({
      recipientId: data.inviteeId,
      actorUserId: userId,
      kind: "lounge_invite",
      entityType: "lounge_room",
      entityId: room.id,
      payload: {
        room_id: room.id,
        title: room.title,
        medium: room.medium ?? null,
        actor_name: inviterName,
        group_slug: groupSlug,
      },
    });


    return { ok: true, roomId: room.id };
  });

export type PendingLoungeInvite = {
  id: string;
  roomId: string;
  title: string;
  medium: string | null;
  inviterName: string | null;
  inviterAvatar: string | null;
  expiresAt: string;
};

/**
 * Pending Lounge invitations for the signed-in viewer. Only returns invites
 * that are still pending, unexpired, and point at a room that's still active.
 */
export const listMyLoungeInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PendingLoungeInvite[]> => {
    const { userId } = context;
    const { data: invites } = await supabaseAdmin
      .from("lounge_invitations")
      .select("id,room_id,inviter_user_id,expires_at")
      .eq("invitee_user_id", userId)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(10);

    const rows = invites ?? [];
    if (rows.length === 0) return [];

    const [{ data: rooms }, { data: profiles }] = await Promise.all([
      supabaseAdmin
        .from("instant_rooms")
        .select("id,title,medium,status")
        .in("id", rows.map((r) => r.room_id as string)),
      supabaseAdmin
        .from("profiles")
        .select("id,display_name,username,avatar_url")
        .in("id", rows.map((r) => r.inviter_user_id as string)),
    ]);

    const roomById = new Map((rooms ?? []).map((r) => [r.id as string, r]));
    const profById = new Map((profiles ?? []).map((p) => [p.id as string, p]));

    return rows.flatMap((r) => {
      const room = roomById.get(r.room_id as string);
      if (!room || room.status !== "active") return [];
      const p = profById.get(r.inviter_user_id as string);
      return [{
        id: r.id as string,
        roomId: room.id as string,
        title: (room.title as string | null) ?? "Lounge",
        medium: (room.medium as string | null) ?? null,
        inviterName: (p?.display_name as string | null) ?? (p?.username as string | null) ?? null,
        inviterAvatar: (p?.avatar_url as string | null) ?? null,
        expiresAt: r.expires_at as string,
      }];
    });
  });

/** Marks an invite accepted or declined. Only the invitee may act on it. */
export const respondToLoungeInvite = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ inviteId: z.string().uuid(), action: z.enum(["accept", "decline"]) }).parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: row, error } = await supabaseAdmin
      .from("lounge_invitations")
      .update({
        status: data.action === "accept" ? "accepted" : "declined",
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.inviteId)
      .eq("invitee_user_id", userId)
      .eq("status", "pending")
      .select("room_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: true, roomId: (row?.room_id as string | undefined) ?? null };
  });



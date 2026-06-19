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

export type HostableWorkshop = {
  id: string;
  slug: string;
  title: string;
  is_lobby: boolean;
  starts_at: string | null;
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

    // Respect blocks both ways
    const { data: blocks } = await supabaseAdmin
      .from("user_blocks")
      .select("blocker_user_id, blocked_user_id")
      .or(
        `and(blocker_user_id.eq.${userId},blocked_user_id.in.(${mutualIds.join(",")})),and(blocked_user_id.eq.${userId},blocker_user_id.in.(${mutualIds.join(",")}))`,
      );
    const blocked = new Set<string>();
    for (const b of blocks ?? []) {
      blocked.add(b.blocker_user_id === userId ? b.blocked_user_id : b.blocker_user_id);
    }
    const targets = mutualIds.filter((id) => !blocked.has(id));
    if (targets.length === 0) return { ok: true, cameOnline: true };

    // Only notify mutuals who opted in (default false)
    const { data: prefs } = await supabaseAdmin
      .from("notification_preferences")
      .select("user_id, inapp_friend_online")
      .in("user_id", targets)
      .eq("inapp_friend_online", true);
    const optedIn = (prefs ?? []).map((p) => p.user_id);
    if (optedIn.length === 0) return { ok: true, cameOnline: true };

    await supabaseAdmin
      .from("notifications")
      .insert(
        optedIn.map((uid) => ({
          user_id: uid,
          kind: "friend_online",
          actor_user_id: userId,
          entity_type: "profile",
          entity_id: userId,
          payload: {
            display_name: prev.display_name,
            username: prev.username,
          },
        })),
      )
      .then(() => null, () => null);

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

/** Active/upcoming Workshops the signed-in user hosts. Used in the invite picker. */
export const listMyHostableWorkshops = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HostableWorkshop[]> => {
    const { userId } = context;
    const { data } = await supabaseAdmin
      .from("workshops")
      .select("id, slug, title, is_lobby, starts_at, status, ends_at")
      .eq("host_user_id", userId)
      .in("status", ["draft", "open", "active", "check_in"])
      .order("starts_at", { ascending: true, nullsFirst: true })
      .limit(30);
    const now = Date.now();
    return (data ?? [])
      .filter((w) => !w.ends_at || new Date(w.ends_at).getTime() > now)
      .map((w) => ({
        id: w.id,
        slug: w.slug,
        title: w.title,
        is_lobby: w.is_lobby,
        starts_at: w.starts_at,
      }));
  });

/**
 * Invite a friend to one of the signed-in user's Workshops.
 * Idempotent — workshop_join_invites has a unique (workshop_id, invitee_user_id).
 */
export const inviteFriendToWorkshop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        workshopId: z.string().uuid(),
        inviteeId: z.string().uuid(),
        sourceRoomId: z.string().uuid().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: ws } = await supabaseAdmin
      .from("workshops")
      .select("id, host_user_id, slug, title, is_lobby")
      .eq("id", data.workshopId)
      .maybeSingle();
    if (!ws) throw new Error("Workshop not found.");
    if (ws.host_user_id !== userId) throw new Error("Only the host can invite people.");
    if (data.inviteeId === userId) throw new Error("Pick someone other than yourself.");

    // Require mutual follow (matches lobby invite rules).
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
      .from("workshop_join_invites")
      .upsert(
        {
          workshop_id: ws.id,
          invitee_user_id: data.inviteeId,
          inviter_user_id: userId,
          source_room_id: data.sourceRoomId ?? null,
          status: "pending",
        },
        { onConflict: "workshop_id,invitee_user_id" },
      )
      .then(() => null, () => null);

    await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: data.inviteeId,
        kind: "workshop_invite_from_room",
        actor_user_id: userId,
        entity_type: "workshop",
        entity_id: ws.id,
        payload: { workshop_slug: ws.slug, title: ws.title, is_lobby: ws.is_lobby },
      })
      .then(() => null, () => null);

    return { ok: true };
  });

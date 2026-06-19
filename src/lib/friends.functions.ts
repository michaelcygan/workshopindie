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

/**
 * Lightweight presence heartbeat. Touches profiles.last_active_at for the
 * signed-in user. Called every ~60s from the root while the tab is visible.
 */
export const pingPresence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    await supabaseAdmin
      .from("profiles")
      .update({ last_active_at: new Date().toISOString() })
      .eq("id", userId);
    return { ok: true };
  });

/**
 * Mutual-follow friends list with online indicator.
 * Online = last_active_at within 2 minutes AND show_online=true.
 */
export const getFriends = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Friend[]> => {
    const { userId } = context;
    const [{ data: iFollow }, { data: followMe }] = await Promise.all([
      supabaseAdmin.from("follows").select("followed_user_id").eq("follower_user_id", userId),
      supabaseAdmin.from("follows").select("follower_user_id").eq("followed_user_id", userId),
    ]);
    const iFollowSet = new Set((iFollow ?? []).map((r) => r.followed_user_id));
    const mutualIds = (followMe ?? [])
      .map((r) => r.follower_user_id)
      .filter((id) => iFollowSet.has(id));
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

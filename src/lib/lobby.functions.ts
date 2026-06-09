import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type LobbyPerson = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_mutual: boolean;
};

/** People I mutually follow (both directions). Optional name/handle search. */
export const listMutualFollows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ q: z.string().trim().max(80).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<LobbyPerson[]> => {
    const { userId } = context;

    // Mutual = I follow them AND they follow me.
    const { data: iFollow } = await supabaseAdmin
      .from("follows")
      .select("followed_user_id")
      .eq("follower_user_id", userId);
    const { data: followMe } = await supabaseAdmin
      .from("follows")
      .select("follower_user_id")
      .eq("followed_user_id", userId);

    const iFollowSet = new Set((iFollow ?? []).map((r) => r.followed_user_id));
    const followMeSet = new Set((followMe ?? []).map((r) => r.follower_user_id));
    const mutualIds = Array.from(iFollowSet).filter((id) => followMeSet.has(id));
    if (mutualIds.length === 0) return [];

    let q = supabaseAdmin
      .from("profiles")
      .select("id, display_name, username, avatar_url")
      .in("id", mutualIds)
      .limit(200);

    if (data.q && data.q.length > 0) {
      const term = `%${data.q.replace(/[%_]/g, "")}%`;
      q = q.or(`display_name.ilike.${term},username.ilike.${term}`);
    }
    const { data: rows } = await q;
    return (rows ?? []).map((p) => ({
      user_id: p.id,
      display_name: p.display_name,
      username: p.username,
      avatar_url: p.avatar_url,
      is_mutual: true,
    }));
  });

/** People I follow (one direction). Used as override when inviting beyond mutuals. */
export const listFollowingForLobby = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ q: z.string().trim().min(1).max(80) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<LobbyPerson[]> => {
    const { userId } = context;
    const { data: iFollow } = await supabaseAdmin
      .from("follows")
      .select("followed_user_id")
      .eq("follower_user_id", userId);
    const ids = (iFollow ?? []).map((r) => r.followed_user_id);
    if (ids.length === 0) return [];

    const { data: followMe } = await supabaseAdmin
      .from("follows")
      .select("follower_user_id")
      .eq("followed_user_id", userId)
      .in("follower_user_id", ids);
    const mutualSet = new Set((followMe ?? []).map((r) => r.follower_user_id));

    const term = `%${data.q.replace(/[%_]/g, "")}%`;
    const { data: rows } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, username, avatar_url")
      .in("id", ids)
      .or(`display_name.ilike.${term},username.ilike.${term}`)
      .limit(40);
    return (rows ?? []).map((p) => ({
      user_id: p.id,
      display_name: p.display_name,
      username: p.username,
      avatar_url: p.avatar_url,
      is_mutual: mutualSet.has(p.id),
    }));
  });

const CategoryEnum = z.enum([
  "visual",
  "music",
  "writing",
  "moving_image",
  "performance",
  "design",
  "code",
  "other",
]);

/** Create a Workshop "lobby" — a draft, invite-only workshop with invitees. */
export const createLobby = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        title: z.string().trim().min(2).max(140),
        prompt: z.string().trim().max(2000).optional().nullable(),
        category: CategoryEnum,
        discoverable: z.boolean(),
        inviteeIds: z.array(z.string().uuid()).max(50).default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Validate every invitee is at least a follow relation (mutual or one-way).
    if (data.inviteeIds.length > 0) {
      const { data: iFollow } = await supabaseAdmin
        .from("follows")
        .select("followed_user_id")
        .eq("follower_user_id", userId)
        .in("followed_user_id", data.inviteeIds);
      const allowed = new Set((iFollow ?? []).map((r) => r.followed_user_id));
      const bad = data.inviteeIds.filter((id) => !allowed.has(id));
      if (bad.length > 0) {
        throw new Error("You can only invite people you already follow.");
      }
    }

    // @ts-expect-error -- new columns not yet in regenerated types
    const { data: ws, error } = await supabaseAdmin
      .from("workshops")
      .insert({
        title: data.title,
        slug: "",
        category: data.category,
        prompt: data.prompt || null,
        host_user_id: userId,
        mode: "scheduled",
        visibility: "invite_only",
        location_type: "online",
        status: "draft",
        is_lobby: true,
        lobby_discoverable: data.discoverable,
      })
      .select("id, slug")
      .single();
    if (error || !ws) throw new Error(error?.message ?? "Couldn't create lobby");

    await supabaseAdmin
      .from("workshop_participants")
      .insert({ workshop_id: ws.id, user_id: userId, participant_status: "confirmed" })
      .then(() => null, () => null);

    if (data.inviteeIds.length > 0) {
      await supabaseAdmin
        .from("workshop_join_invites")
        .insert(
          data.inviteeIds.map((uid) => ({
            workshop_id: ws.id,
            invitee_user_id: uid,
            inviter_user_id: userId,
            status: "pending",
          })),
        )
        .then(() => null, () => null);

      await supabaseAdmin
        .from("notifications")
        .insert(
          data.inviteeIds.map((uid) => ({
            user_id: uid,
            kind: "workshop_invite_from_room",
            actor_user_id: userId,
            entity_type: "workshop",
            entity_id: ws.id,
            payload: { workshop_slug: ws.slug, title: data.title, is_lobby: true },
          })),
        )
        .then(() => null, () => null);
    }

    return { id: ws.id, slug: ws.slug };
  });

export type LobbyCard = {
  id: string;
  slug: string;
  title: string;
  prompt: string | null;
  category: string;
  host_user_id: string;
  host_display_name: string | null;
  host_username: string | null;
  host_avatar_url: string | null;
  member_count: number;
  invite_status: "host" | "member" | "pending" | "discoverable";
  lobby_discoverable: boolean;
};

/** Lobbies the user hosts, is a member of, or has a pending invite to. */
export const listMyLobbies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LobbyCard[]> => {
    const { userId } = context;

    const [hosted, pending, member] = await Promise.all([
      supabaseAdmin
        .from("workshops")
        .select("id, slug, title, prompt, category, host_user_id, lobby_discoverable")
        .eq("host_user_id", userId)
        .eq("is_lobby", true)
        .order("updated_at", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("workshop_join_invites")
        .select("workshop_id, workshops!inner(id, slug, title, prompt, category, host_user_id, is_lobby, lobby_discoverable)")
        .eq("invitee_user_id", userId)
        .eq("status", "pending")
        .limit(40),
      supabaseAdmin
        .from("workshop_participants")
        .select("workshop_id, workshops!inner(id, slug, title, prompt, category, host_user_id, is_lobby, lobby_discoverable)")
        .eq("user_id", userId)
        .eq("participant_status", "confirmed")
        .limit(80),
    ]);

    type Row = { id: string; slug: string; title: string; prompt: string | null; category: string; host_user_id: string; lobby_discoverable?: boolean };
    const combined = new Map<string, { row: Row; status: LobbyCard["invite_status"] }>();
    for (const row of (hosted.data ?? []) as Row[]) {
      combined.set(row.id, { row, status: "host" });
    }
    for (const r of (pending.data ?? []) as Array<{ workshops: Row & { is_lobby: boolean } }>) {
      const w = r.workshops;
      if (!w?.is_lobby) continue;
      if (!combined.has(w.id)) combined.set(w.id, { row: w, status: "pending" });
    }
    for (const r of (member.data ?? []) as Array<{ workshops: Row & { is_lobby: boolean } }>) {
      const w = r.workshops;
      if (!w?.is_lobby || w.host_user_id === userId) continue;
      if (!combined.has(w.id)) combined.set(w.id, { row: w, status: "member" });
    }

    const ids = Array.from(combined.keys());
    if (ids.length === 0) return [];

    const [hostsRes, countsRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .in("id", Array.from(new Set(Array.from(combined.values()).map((v) => v.row.host_user_id)))),
      supabaseAdmin
        .from("workshop_participants")
        .select("workshop_id")
        .eq("participant_status", "confirmed")
        .in("workshop_id", ids),
    ]);
    const hostMap = new Map((hostsRes.data ?? []).map((p) => [p.id, p]));
    const countMap = new Map<string, number>();
    for (const r of countsRes.data ?? []) {
      countMap.set(r.workshop_id, (countMap.get(r.workshop_id) ?? 0) + 1);
    }

    return Array.from(combined.values()).map(({ row, status }) => {
      const h = hostMap.get(row.host_user_id);
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        prompt: row.prompt,
        category: row.category,
        host_user_id: row.host_user_id,
        host_display_name: h?.display_name ?? null,
        host_username: h?.username ?? null,
        host_avatar_url: h?.avatar_url ?? null,
        member_count: countMap.get(row.id) ?? 0,
        invite_status: status,
        lobby_discoverable: row.lobby_discoverable ?? false,
      };
    });
  });

/** Discoverable lobbies hosted by people the viewer mutually follows. */
export const listDiscoverableLobbies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LobbyCard[]> => {
    const { userId } = context;

    const { data: iFollow } = await supabaseAdmin
      .from("follows").select("followed_user_id").eq("follower_user_id", userId);
    const { data: followMe } = await supabaseAdmin
      .from("follows").select("follower_user_id").eq("followed_user_id", userId);
    const iFollowSet = new Set((iFollow ?? []).map((r) => r.followed_user_id));
    const mutuals = Array.from(iFollowSet).filter((id) => (followMe ?? []).some((f) => f.follower_user_id === id));
    if (mutuals.length === 0) return [];

    const { data: rows } = await supabaseAdmin
      .from("workshops")
      .select("id, slug, title, prompt, category, host_user_id, lobby_discoverable")
      .eq("is_lobby", true)
      .eq("lobby_discoverable", true)
      .in("host_user_id", mutuals)
      .order("updated_at", { ascending: false })
      .limit(30);
    if (!rows || rows.length === 0) return [];

    const [hostsRes, countsRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .in("id", mutuals),
      supabaseAdmin
        .from("workshop_participants")
        .select("workshop_id")
        .eq("participant_status", "confirmed")
        .in("workshop_id", rows.map((r) => r.id)),
    ]);
    const hostMap = new Map((hostsRes.data ?? []).map((p) => [p.id, p]));
    const countMap = new Map<string, number>();
    for (const r of countsRes.data ?? []) {
      countMap.set(r.workshop_id, (countMap.get(r.workshop_id) ?? 0) + 1);
    }

    return rows.map((row) => {
      const h = hostMap.get(row.host_user_id);
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        prompt: row.prompt,
        category: row.category,
        host_user_id: row.host_user_id,
        host_display_name: h?.display_name ?? null,
        host_username: h?.username ?? null,
        host_avatar_url: h?.avatar_url ?? null,
        member_count: countMap.get(row.id) ?? 0,
        invite_status: "discoverable" as const,
        lobby_discoverable: true,
      };
    });
  });

/** Mutual follow asks to join a discoverable lobby — creates a pending invite. */
export const requestToJoinLobby = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ workshopId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // @ts-expect-error new column not yet in types
    const { data: ws } = await supabaseAdmin
      .from("workshops")
      .select("id, host_user_id, is_lobby, lobby_discoverable, title, slug")
      .eq("id", data.workshopId)
      .maybeSingle();
    if (!ws || !ws.is_lobby || !ws.lobby_discoverable) throw new Error("Lobby not found.");

    const { data: a } = await supabaseAdmin
      .from("follows").select("follower_user_id").eq("follower_user_id", userId).eq("followed_user_id", ws.host_user_id).maybeSingle();
    const { data: b } = await supabaseAdmin
      .from("follows").select("follower_user_id").eq("follower_user_id", ws.host_user_id).eq("followed_user_id", userId).maybeSingle();
    if (!a || !b) throw new Error("Only mutual follows can request to join.");

    await supabaseAdmin
      .from("workshop_join_invites")
      .upsert({
        workshop_id: ws.id,
        invitee_user_id: userId,
        inviter_user_id: ws.host_user_id,
        status: "pending",
      }, { onConflict: "workshop_id,invitee_user_id" })
      .then(() => null, () => null);

    await supabaseAdmin.from("notifications").insert({
      user_id: ws.host_user_id,
      kind: "workshop_invite_from_room",
      actor_user_id: userId,
      entity_type: "workshop",
      entity_id: ws.id,
      payload: { workshop_slug: ws.slug, title: ws.title, is_lobby: true, requested: true },
    }).then(() => null, () => null);

    return { ok: true };
  });

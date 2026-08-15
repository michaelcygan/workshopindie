/**
 * "Here now" — who is online on Workshop right now, scoped by the viewer.
 *
 * Reads the ephemeral presence tier (`public.user_presence`) that the
 * heartbeat already maintains. Nothing is written here.
 *
 * Privacy invariants for every scope:
 *  - a person with `show_online = false` never appears,
 *  - blocks are honored in both directions,
 *  - the viewer never sees themself.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ONLINE_WINDOW_MS } from "@/lib/presence/policy";

export const HERE_NOW_SCOPES = ["mutuals", "city", "groups", "everyone"] as const;
export type HereNowScope = (typeof HERE_NOW_SCOPES)[number];

export const HERE_NOW_SCOPE_LABEL: Record<HereNowScope, string> = {
  mutuals: "Mutuals",
  city: "My city",
  groups: "My groups",
  everyone: "Everyone",
};

export type HereNowPerson = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

const MAX_PEOPLE = 12;

export const getHereNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { scope?: HereNowScope; cityGroupId?: string | null }) => ({
    scope: (HERE_NOW_SCOPES as readonly string[]).includes(input?.scope ?? "")
      ? (input.scope as HereNowScope)
      : ("mutuals" as HereNowScope),
    cityGroupId: input?.cityGroupId ?? null,
  }))
  .handler(async ({ data, context }): Promise<HereNowPerson[]> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const cutoff = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString();

    const { data: presence } = await supabaseAdmin
      .from("user_presence")
      .select("user_id, last_seen_at")
      .eq("show_online", true)
      .gte("last_seen_at", cutoff)
      .order("last_seen_at", { ascending: false })
      .limit(300);

    let candidates = (presence ?? [])
      .map((p) => p.user_id as string)
      .filter((id) => id && id !== userId);
    if (candidates.length === 0) return [];

    // Scope filter.
    if (data.scope === "mutuals") {
      const [{ data: iFollow }, { data: followMe }] = await Promise.all([
        supabaseAdmin.from("follows").select("followed_user_id").eq("follower_user_id", userId),
        supabaseAdmin.from("follows").select("follower_user_id").eq("followed_user_id", userId),
      ]);
      const iFollowSet = new Set((iFollow ?? []).map((r) => r.followed_user_id as string));
      const mutuals = new Set(
        (followMe ?? [])
          .map((r) => r.follower_user_id as string)
          .filter((id) => iFollowSet.has(id)),
      );
      candidates = candidates.filter((id) => mutuals.has(id));
    } else if (data.scope === "city") {
      if (!data.cityGroupId) return [];
      const { data: members } = await supabaseAdmin
        .from("group_members")
        .select("user_id")
        .eq("group_id", data.cityGroupId)
        .in("user_id", candidates);
      const set = new Set((members ?? []).map((m) => m.user_id as string));
      candidates = candidates.filter((id) => set.has(id));
    } else if (data.scope === "groups") {
      const { data: mine } = await supabaseAdmin
        .from("group_members")
        .select("group_id")
        .eq("user_id", userId);
      const groupIds = (mine ?? []).map((g) => g.group_id as string);
      if (groupIds.length === 0) return [];
      const { data: members } = await supabaseAdmin
        .from("group_members")
        .select("user_id")
        .in("group_id", groupIds)
        .in("user_id", candidates);
      const set = new Set((members ?? []).map((m) => m.user_id as string));
      candidates = candidates.filter((id) => set.has(id));
    }

    if (candidates.length === 0) return [];

    // Blocks, both directions.
    const [{ data: blocksMine }, { data: blocksOnMe }] = await Promise.all([
      supabaseAdmin.from("user_blocks").select("blocked_user_id").eq("blocker_user_id", userId),
      supabaseAdmin.from("user_blocks").select("blocker_user_id").eq("blocked_user_id", userId),
    ]);
    const blocked = new Set<string>([
      ...(blocksMine ?? []).map((r) => r.blocked_user_id as string),
      ...(blocksOnMe ?? []).map((r) => r.blocker_user_id as string),
    ]);
    candidates = candidates.filter((id) => !blocked.has(id)).slice(0, MAX_PEOPLE * 3);
    if (candidates.length === 0) return [];

    const { data: rows } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, username, avatar_url, show_online")
      .in("id", candidates);

    const byId = new Map(
      (rows ?? [])
        .filter((p) => p.show_online !== false)
        .map((p) => [
          p.id as string,
          {
            user_id: p.id as string,
            display_name: (p.display_name as string | null) ?? null,
            username: (p.username as string | null) ?? null,
            avatar_url: (p.avatar_url as string | null) ?? null,
          } satisfies HereNowPerson,
        ]),
    );

    // Preserve the most-recently-seen ordering from the presence query.
    const out: HereNowPerson[] = [];
    for (const id of candidates) {
      const person = byId.get(id);
      if (person) out.push(person);
      if (out.length >= MAX_PEOPLE) break;
    }
    return out;
  });

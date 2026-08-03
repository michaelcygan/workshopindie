/**
 * Shared "who is viewing this Group right now" presence.
 *
 * One Realtime topic per Group (`group-presence:<groupId>`) so every viewer
 * lands in the same room. Presence key is the authenticated user id, which
 * makes multi-tab dedupe trivial. Nothing durable is ever written.
 *
 * This is deliberately separate from audio connection state: being "here now"
 * means viewing the Group, not being connected to the audio room.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type GroupPresenceUser = {
  user_id: string;
  display_name: string | null;
  handle: string | null;
  avatar_url: string | null;
  online_at: string;
};

export function useGroupPresence(groupId: string | null | undefined) {
  const { user } = useAuth();
  const [users, setUsers] = useState<GroupPresenceUser[]>([]);

  useEffect(() => {
    if (!groupId || !user) {
      setUsers([]);
      return;
    }
    let cancelled = false;

    const channel = supabase.channel(`group-presence:${groupId}`, {
      config: { presence: { key: user.id } },
    });

    const syncState = () => {
      const state = channel.presenceState() as Record<string, GroupPresenceUser[]>;
      const seen = new Set<string>();
      const flat: GroupPresenceUser[] = [];
      for (const arr of Object.values(state)) {
        for (const u of arr) {
          if (!u?.user_id || seen.has(u.user_id)) continue;
          seen.add(u.user_id);
          flat.push(u);
        }
      }
      flat.sort((a, b) => (a.online_at ?? "").localeCompare(b.online_at ?? ""));
      if (!cancelled) setUsers(flat);
    };

    channel
      .on("presence", { event: "sync" }, syncState)
      .on("presence", { event: "join" }, syncState)
      .on("presence", { event: "leave" }, syncState)
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        const meta = user.user_metadata as Record<string, unknown> | undefined;
        await channel.track({
          user_id: user.id,
          display_name:
            (meta?.display_name as string | undefined) ??
            (meta?.full_name as string | undefined) ??
            (user.email?.split("@")[0] ?? null),
          handle: (meta?.username as string | undefined) ?? null,
          avatar_url: (meta?.avatar_url as string | undefined) ?? null,
          online_at: new Date().toISOString(),
        } satisfies GroupPresenceUser);
      });

    return () => {
      cancelled = true;
      channel.untrack().catch(() => { /* channel already torn down */ });
      supabase.removeChannel(channel);
    };
  }, [groupId, user]);

  return useMemo(() => ({ users, count: users.length }), [users]);
}

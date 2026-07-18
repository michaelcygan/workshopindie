import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type PresenceUser = {
  user_id: string;
  display_name: string | null;
  handle: string | null;
  avatar_url: string | null;
  online_at: string;
};

/**
 * Live "Who's here" avatar cluster for a group's Today tab.
 * Ephemeral — uses Supabase Realtime Presence, no DB writes.
 * Hidden for logged-out users.
 */
export function TodayPresenceBubbles({ groupId }: { groupId: string }) {
  const { user } = useAuth();
  const [users, setUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const suffix = Math.random().toString(36).slice(2, 8);
    const channel = supabase.channel(`gtp-presence-${groupId}-${suffix}`, {
      config: { presence: { key: user.id } },
    });

    const syncState = () => {
      const state = channel.presenceState() as Record<string, PresenceUser[]>;
      const flat: PresenceUser[] = [];
      const seen = new Set<string>();
      for (const arr of Object.values(state)) {
        for (const u of arr) {
          if (!u?.user_id || seen.has(u.user_id)) continue;
          seen.add(u.user_id);
          flat.push(u);
        }
      }
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
        } satisfies PresenceUser);
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [groupId, user]);

  const { visible, overflow } = useMemo(() => {
    const max = 5;
    return { visible: users.slice(0, max), overflow: Math.max(0, users.length - max) };
  }, [users]);

  if (!user || users.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1.5">
        <span className="hidden text-[11px] font-medium uppercase tracking-wide text-ink-soft sm:inline">
          Here now
        </span>
        <div className="flex -space-x-2">
          {visible.map((u) => {
            const label = u.display_name || u.handle || "Member";
            return (
              <Tooltip key={u.user_id}>
                <TooltipTrigger asChild>
                  <Avatar className="h-6 w-6 border-2 border-surface">
                    {u.avatar_url ? <AvatarImage src={u.avatar_url} alt={label} /> : null}
                    <AvatarFallback className="text-[10px]">
                      {label.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {label}
                  {u.handle ? <span className="ml-1 text-ink-soft">@{u.handle}</span> : null}
                </TooltipContent>
              </Tooltip>
            );
          })}
          {overflow > 0 ? (
            <div className="flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-surface bg-muted px-1.5 text-[10px] font-medium text-ink-soft">
              +{overflow}
            </div>
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  );
}

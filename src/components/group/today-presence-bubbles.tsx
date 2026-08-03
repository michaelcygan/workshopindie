import { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useGroupPresence } from "@/hooks/use-group-presence";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Live "Here now" avatar cluster for a Group.
 * Ephemeral — one shared Realtime Presence topic per Group, no DB writes.
 * Hidden for logged-out users.
 */
export function TodayPresenceBubbles({ groupId }: { groupId: string }) {
  const { user } = useAuth();
  const { users } = useGroupPresence(groupId);


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

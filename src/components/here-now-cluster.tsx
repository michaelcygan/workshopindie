import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  getHereNow,
  HERE_NOW_SCOPES,
  HERE_NOW_SCOPE_LABEL,
  type HereNowScope,
} from "@/lib/here-now.functions";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "workshop:here-now-scope";

function readScope(): HereNowScope {
  if (typeof window === "undefined") return "mutuals";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return (HERE_NOW_SCOPES as readonly string[]).includes(raw ?? "")
    ? (raw as HereNowScope)
    : "mutuals";
}

/**
 * Live "Here now" avatar cluster — people online right now, scoped by the
 * viewer (mutuals by default). Hover shows the name, click opens the profile.
 * Renders nothing when logged out or when nobody qualifies, so the host
 * header keeps its current empty-state look.
 */
export function HereNowCluster({
  cityGroupId,
  max = 5,
  className,
}: {
  cityGroupId?: string | null;
  max?: number;
  className?: string;
}) {
  const { user } = useAuth();
  const [scope, setScope] = useState<HereNowScope>("mutuals");
  const [open, setOpen] = useState(false);

  // localStorage is read after mount so SSR and hydration agree.
  useEffect(() => setScope(readScope()), []);

  const fetchHereNow = useServerFn(getHereNow);
  const { data = [] } = useQuery({
    queryKey: ["here-now", scope, cityGroupId ?? null],
    enabled: !!user,
    queryFn: () => fetchHereNow({ data: { scope, cityGroupId: cityGroupId ?? null } }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (!user || data.length === 0) return null;

  const visible = data.slice(0, max);
  const overflow = Math.max(0, data.length - visible.length);

  function pick(next: HereNowScope) {
    setScope(next);
    setOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className={cn("flex min-w-0 items-center gap-2", className)}>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="hidden shrink-0 font-display text-[10px] uppercase tracking-[0.12em] text-ink-muted transition-colors hover:text-ink sm:inline"
              aria-label="Change who shows as here now"
            >
              Here now · {HERE_NOW_SCOPE_LABEL[scope]}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={8} className="w-44 p-1">
            {HERE_NOW_SCOPES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => pick(s)}
                className="flex w-full items-center justify-between rounded-[6px] px-2.5 py-1.5 text-left text-[13px] text-ink transition-colors hover:bg-surface-2"
              >
                {HERE_NOW_SCOPE_LABEL[s]}
                {s === scope ? <Check className="size-3.5 text-ink-muted" /> : null}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <div className="flex -space-x-2">
          {visible.map((p) => {
            const label = p.display_name || p.username || "Member";
            const avatar = (
              <Avatar className="h-6 w-6 border-2 border-card transition-transform hover:z-10 hover:-translate-y-0.5">
                {p.avatar_url ? <AvatarImage src={p.avatar_url} alt={label} /> : null}
                <AvatarFallback className="text-[10px]">
                  {label.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            );
            return (
              <Tooltip key={p.user_id}>
                <TooltipTrigger asChild>
                  {p.username ? (
                    <Link
                      to="/$username"
                      params={{ username: p.username }}
                      aria-label={`View ${label}'s profile`}
                    >
                      {avatar}
                    </Link>
                  ) : (
                    <span>{avatar}</span>
                  )}
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {label}
                  {p.username ? <span className="ml-1 text-ink-muted">@{p.username}</span> : null}
                </TooltipContent>
              </Tooltip>
            );
          })}
          {overflow > 0 ? (
            <div className="flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-card bg-muted px-1.5 text-[10px] font-medium text-ink-muted">
              +{overflow}
            </div>
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  );
}

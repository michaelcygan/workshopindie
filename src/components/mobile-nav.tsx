import { Link, useNavigate } from "@tanstack/react-router";
import { Radio, Users, LayoutGrid, Sparkles, Gift, Briefcase, Ticket, Settings as SettingsIcon, MoreHorizontal, ListChecks, Calendar } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

const tabBase =
  "flex flex-1 basis-0 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1.5 text-[10px] font-medium text-ink-muted transition-colors hover:text-ink";
const tabActive =
  "flex flex-1 basis-0 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1.5 text-[10px] font-semibold text-ink bg-muted";

export function MobileNav() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "Your account";
  const initial = displayName?.[0]?.toUpperCase() ?? "·";

  return (
    <div className="fixed inset-x-0 bottom-3 z-50 flex justify-center px-3 md:hidden">
      <div className="flex w-full max-w-md items-stretch gap-0.5 rounded-full border border-border/70 bg-background/90 px-2 py-1.5 shadow-lg backdrop-blur-md">
        <Link to="/workshop" className={tabBase} activeProps={{ className: tabActive }}>
          <Radio className="h-[18px] w-[18px]" />
          <span>Workshops</span>
        </Link>
        <Link to="/collab" className={tabBase} activeProps={{ className: tabActive }}>
          <Users className="h-[18px] w-[18px]" />
          <span>Collabs</span>
        </Link>
        <Link to="/groups" className={tabBase} activeProps={{ className: tabActive }}>
          <Sparkles className="h-[18px] w-[18px]" />
          <span>Groups</span>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={tabBase} aria-label="More">
              <MoreHorizontal className="h-[18px] w-[18px]" />
              <span>More</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top" className="w-52">
            <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
              More
            </DropdownMenuLabel>
            {user && (
              <DropdownMenuItem onClick={() => navigate({ to: "/in-progress" })}>
                <ListChecks className="mr-2 h-4 w-4" /> In Progress
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => navigate({ to: "/gallery" })}>
              <LayoutGrid className="mr-2 h-4 w-4" /> Work
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate({ to: "/groups" })}>
              <Calendar className="mr-2 h-4 w-4" /> Events
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={tabBase} aria-label="Your account">
                <Avatar className="h-[18px] w-[18px]">
                  <AvatarImage src={user.user_metadata?.avatar_url} />
                  <AvatarFallback className="text-[9px]">{initial}</AvatarFallback>
                </Avatar>
                <span>You</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-60">
              <button
                type="button"
                onClick={() => navigate({ to: "/me" })}
                className="flex w-full items-center gap-3 px-2 py-2 text-left hover:bg-muted/70 rounded-sm transition"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user.user_metadata?.avatar_url} />
                  <AvatarFallback className="text-xs">{initial}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-ink">{displayName}</div>
                  <div className="truncate text-xs text-ink-muted">View your profile</div>
                </div>
              </button>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ to: "/me/collabs" })}>
                <Briefcase className="mr-2 h-4 w-4" /> My Collabs
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/me/network" })}>
                <Users className="mr-2 h-4 w-4" /> Network
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/me/tickets" })}>
                <Ticket className="mr-2 h-4 w-4" /> My Events
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/refer" })}>
                <Gift className="mr-2 h-4 w-4" /> Refer & Earn
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                <SettingsIcon className="mr-2 h-4 w-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate({ to: "/" });
                }}
              >
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link to="/login" className={tabBase} activeProps={{ className: tabActive }}>
            <Avatar className="h-[18px] w-[18px]">
              <AvatarFallback className="text-[9px]">·</AvatarFallback>
            </Avatar>
            <span>Sign in</span>
          </Link>
        )}
      </div>
    </div>
  );
}

import { useNavigate } from "@tanstack/react-router";
import {
  Settings as SettingsIcon,
  Briefcase,
  Users,
  Ticket,
  LayoutGrid,
  Calendar,
  Gift,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

export function SettingsMenuButton() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const displayName =
    (user.user_metadata?.display_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Your account";
  const initial = displayName?.[0]?.toUpperCase() ?? "·";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Settings and account"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-soft ring-1 ring-border hover:bg-muted"
        >
          <SettingsIcon className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <button
          type="button"
          onClick={() => navigate({ to: "/me" })}
          className="flex w-full items-center gap-3 rounded-sm px-2 py-2 text-left transition hover:bg-muted/70"
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
        <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          Your stuff
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => navigate({ to: "/me/collabs" })}>
          <Briefcase className="mr-2 h-4 w-4" /> My Collabs
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate({ to: "/me/network" })}>
          <Users className="mr-2 h-4 w-4" /> Network
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate({ to: "/events", search: { mine: true } })}>
          <Ticket className="mr-2 h-4 w-4" /> My RSVPs
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          Explore
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => navigate({ to: "/gallery" })}>
          <LayoutGrid className="mr-2 h-4 w-4" /> Gallery
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate({ to: "/events" })}>
          <Calendar className="mr-2 h-4 w-4" /> Events
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: "/refer" })}>
          <Gift className="mr-2 h-4 w-4" /> Refer & Earn
        </DropdownMenuItem>
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
  );
}

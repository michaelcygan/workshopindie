import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-role";
import { usePlus } from "@/hooks/use-plus";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Radio, Shield, Megaphone, Sparkles, Gift, Settings as SettingsIcon, Users, Plus, Coffee, Ticket } from "lucide-react";
import { NotificationsBell } from "@/components/notifications-bell";
import { MessagesInboxButton } from "@/components/messages-inbox-button";
import { GroupsNavItem } from "@/components/groups-nav-item";

export function TopNav() {
  const { user, loading } = useAuth();
  const { isAdmin } = useUserRoles();
  const { isPlus } = usePlus();
  const navigate = useNavigate();

  const initial =
    (user?.user_metadata?.display_name as string | undefined)?.[0] ??
    user?.email?.[0]?.toUpperCase() ??
    "·";

  return (
    <header className="sticky top-0 z-40 hidden border-b border-border/70 bg-background/80 backdrop-blur-md md:block">
      <div className="relative mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:px-6">
        <Link to="/" className="flex items-center gap-2 font-display text-xl tracking-tight text-ink justify-self-start">
          <span className="inline-block h-2.5 w-2.5 rounded-full gradient-motion" />
          Workshop
        </Link>

        <nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-1 md:flex">
          <Link data-firstrun="instant" to="/workshop" className="rounded-full px-3 py-1.5 text-sm text-ink-soft hover:bg-muted transition" activeProps={{ className: "rounded-full px-3 py-1.5 text-sm text-ink bg-muted" }}>Workshop</Link>
          <Link to="/collab" className="rounded-full px-3 py-1.5 text-sm text-ink-soft hover:bg-muted transition" activeProps={{ className: "rounded-full px-3 py-1.5 text-sm text-ink bg-muted" }}>Collab</Link>
          <Link to="/gallery" className="rounded-full px-3 py-1.5 text-sm text-ink-soft hover:bg-muted transition" activeProps={{ className: "rounded-full px-3 py-1.5 text-sm text-ink bg-muted" }}>Work</Link>
          <GroupsNavItem />
        </nav>


        <div className="ml-auto flex items-center gap-2">
          {user && !isPlus && (
            <Link to="/pricing" className="hidden md:inline-flex">
              <Button size="sm" variant="ghost" className="rounded-full gap-1.5 hover:bg-muted">
                <Sparkles className="h-3.5 w-3.5 icon-gradient-motion" />
                <span className="text-gradient-motion">Go Plus</span>
              </Button>
            </Link>
          )}
          {isPlus && (
            <span className="hidden md:inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
              <Sparkles className="h-3 w-3 icon-gradient-motion" />
              <span className="text-gradient-motion">Plus</span>
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button data-firstrun="collab" size="sm" className="hidden md:inline-flex rounded-full gap-1.5">
                <Plus className="h-4 w-4" /> Create
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => navigate({ to: "/collab/new" })}>
                <Megaphone className="mr-2 h-4 w-4" /> Post a Collab
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/workshops/lobby/new" })}>
                <Coffee className="mr-2 h-4 w-4" /> Create a Workshop
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>


          {loading ? null : user ? (
            <>
            <MessagesInboxButton />
            <NotificationsBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button data-firstrun="publish" className="flex items-center rounded-full ring-1 ring-border hover:ring-border-strong transition">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.user_metadata?.avatar_url} />
                    <AvatarFallback className="text-xs">{initial}</AvatarFallback>
                  </Avatar>
                </button>

              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => navigate({ to: "/me" })}>My profile</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/workshop" })}>
                  <Radio className="mr-2 h-4 w-4" /> Drop in
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/me/collabs" })}>
                  <Users className="mr-2 h-4 w-4" /> My Collabs
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/me/network" })}>
                  <Users className="mr-2 h-4 w-4" /> Network
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/me/tickets" })}>
                  <Ticket className="mr-2 h-4 w-4" /> My Events
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/collab/new" })}>
                  <Megaphone className="mr-2 h-4 w-4" /> Post a Collab
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: isPlus ? "/settings" : "/pricing", ...(isPlus ? { hash: "plus" } : {}) })}>
                  <Sparkles className="mr-2 h-4 w-4" /> {isPlus ? "Manage Plus" : "Go Plus"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/refer" })}>
                  <Gift className="mr-2 h-4 w-4" /> Refer & Earn
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                  <SettingsIcon className="mr-2 h-4 w-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate({ to: "/admin" })}>
                    <Shield className="mr-2 h-4 w-4" /> Admin
                  </DropdownMenuItem>
                )}
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
            </>
          ) : (
            <>
              <Link to="/login" className="hidden md:block">
                <Button size="sm" variant="ghost" className="rounded-full">Sign in</Button>
              </Link>
              <Link to="/signup">
                <Button size="sm" variant="outline" className="rounded-full">Get started</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

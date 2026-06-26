import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-role";
import { useInProgressBadge } from "@/hooks/use-in-progress-badge";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Shield,
  Megaphone,
  Gift,
  Settings as SettingsIcon,
  Users,
  Plus,
  Coffee,
  Ticket,
  Briefcase,
  ChevronRight,
  ChevronDown,
  LayoutGrid,
  Calendar,

  ListChecks,

} from "lucide-react";
import { NotificationsBell } from "@/components/notifications-bell";
import { MessagesInboxButton } from "@/components/messages-inbox-button";
import { GroupsNavItem } from "@/components/groups-nav-item";

const navLinkBase =
  "rounded-full px-3 py-1.5 text-sm text-ink-soft hover:bg-muted transition";
const navLinkActive =
  "rounded-full px-3 py-1.5 text-sm text-ink bg-muted";

export function TopNav() {
  const { user, loading } = useAuth();
  const { isAdmin } = useUserRoles();
  const navigate = useNavigate();

  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "Your account";
  const initial = displayName?.[0]?.toUpperCase() ?? "·";

  return (
    <header className="sticky top-0 z-40 hidden border-b border-border/70 bg-background/80 backdrop-blur-md md:block">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4 md:px-6">
        {/* Left: brand wordmark → home */}
        <div className="flex flex-1 items-center justify-start">
          <Link
            to="/"
            aria-label="Home"
            className="group inline-flex items-center gap-2 rounded-full px-2 py-1.5 transition hover:bg-muted"
          >
            <span className="inline-block h-2.5 w-2.5 rounded-full gradient-motion" />
            <span className="font-display text-lg leading-none tracking-tight text-ink">
              Workshop
            </span>
          </Link>
        </div>

        {/* Center: primary nav */}
        <nav className="flex flex-1 items-center justify-center gap-1">
          <Link
            data-firstrun="instant"
            to="/lounge"
            className={navLinkBase}
            activeProps={{ className: navLinkActive }}
          >
            Lounge
          </Link>
          <Link to="/collab" className={navLinkBase} activeProps={{ className: navLinkActive }}>
            Collabs
          </Link>
          <GroupsNavItem />
          <Link to="/events" className={navLinkBase} activeProps={{ className: navLinkActive }}>
            Events
          </Link>
          <HoverMoreMenu navigate={navigate} hasUser={!!user} />



        </nav>


        <div className="flex flex-1 items-center justify-end gap-2">

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button data-firstrun="collab" size="sm" className="hidden md:inline-flex rounded-full gap-1.5">
                <Plus className="h-4 w-4" /> Create
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => navigate({ to: "/works/new" })}>
                <Briefcase className="mr-2 h-4 w-4" /> Post a Work
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/collab/new" })}>
                <Megaphone className="mr-2 h-4 w-4" /> Post a Collab
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>


          {loading ? null : user ? (
            <>
            <MessagesInboxButton />
            <NotificationsBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button data-firstrun="publish" className="relative flex items-center rounded-full ring-1 ring-border hover:ring-border-strong transition" aria-label="Your account">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.user_metadata?.avatar_url} />
                    <AvatarFallback className="text-xs">{initial}</AvatarFallback>
                  </Avatar>
                  <InProgressBadgeDot />
                </button>

              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                {/* Identity header → profile */}
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

                {/* My stuff submenu */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Briefcase className="mr-2 h-4 w-4" /> My stuff
                    <ChevronRight className="ml-auto h-4 w-4 opacity-60" />
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-52">
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
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                  <SettingsIcon className="mr-2 h-4 w-4" /> Settings
                </DropdownMenuItem>

                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate({ to: "/admin" })}>
                      <Shield className="mr-2 h-4 w-4" /> Admin
                    </DropdownMenuItem>
                  </>
                )}
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

function HoverMoreMenu({
  navigate,
  hasUser,
}: {
  navigate: ReturnType<typeof useNavigate>;
  hasUser: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const goTo = (to: "/in-progress" | "/gallery" | "/events") => {
    setOpen(false);
    navigate({ to });
  };

  return (
    <div className="relative">
      <DropdownMenu key={pathname} open={open} onOpenChange={setOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={`${navLinkBase} inline-flex items-center gap-1`}
            aria-expanded={open}
          >
            More
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        {open ? (
          <DropdownMenuContent align="center" className="w-52">
            {hasUser && (
              <DropdownMenuItem onSelect={() => goTo("/in-progress")}>
                <ListChecks className="mr-2 h-4 w-4" /> In Progress
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => goTo("/gallery")}>
              <LayoutGrid className="mr-2 h-4 w-4" /> Work
            </DropdownMenuItem>

          </DropdownMenuContent>
        ) : null}
      </DropdownMenu>
    </div>
  );
}

function InProgressBadgeDot() {
  const { count } = useInProgressBadge();
  if (count <= 0) return null;
  return (
    <span
      aria-label={`${count} in progress`}
      className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground ring-2 ring-background"
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

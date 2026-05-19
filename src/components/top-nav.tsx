import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-role";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Radio, Shield, Megaphone } from "lucide-react";
import { NotificationsBell } from "@/components/notifications-bell";

export function TopNav() {
  const { user, loading } = useAuth();
  const { isAdmin } = useUserRoles();
  const navigate = useNavigate();

  const initial =
    (user?.user_metadata?.display_name as string | undefined)?.[0] ??
    user?.email?.[0]?.toUpperCase() ??
    "·";

  return (
    <header className="sticky top-0 z-40 hidden border-b border-border/70 bg-background/80 backdrop-blur-md md:block">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 md:px-6">
        <Link to="/" className="flex items-center gap-2 font-display text-xl tracking-tight text-ink">
          <span className="inline-block h-2.5 w-2.5 rounded-full gradient-motion" />
          Workshop
        </Link>

        <nav className="ml-6 hidden items-center gap-1 md:flex">
          <Link to="/instant" className="rounded-full px-3 py-1.5 text-sm text-ink-soft hover:bg-muted transition" activeProps={{ className: "rounded-full px-3 py-1.5 text-sm text-ink bg-muted" }}>Workshop</Link>
          <Link to="/collab" className="rounded-full px-3 py-1.5 text-sm text-ink-soft hover:bg-muted transition" activeProps={{ className: "rounded-full px-3 py-1.5 text-sm text-ink bg-muted" }}>Collab</Link>
          <Link to="/gallery" className="rounded-full px-3 py-1.5 text-sm text-ink-soft hover:bg-muted transition" activeProps={{ className: "rounded-full px-3 py-1.5 text-sm text-ink bg-muted" }}>Gallery</Link>
          <Link to="/cities" className="rounded-full px-3 py-1.5 text-sm text-ink-soft hover:bg-muted transition" activeProps={{ className: "rounded-full px-3 py-1.5 text-sm text-ink bg-muted" }}>Cities</Link>
        </nav>


        <div className="ml-auto flex items-center gap-2">
          <Link to="/collab/new" className="hidden md:inline-flex">
            <Button size="sm" className="rounded-full gap-1.5">
              <Megaphone className="h-4 w-4" /> Post a Collab
            </Button>
          </Link>

          {loading ? null : user ? (
            <>
            <NotificationsBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center rounded-full ring-1 ring-border hover:ring-border-strong transition">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.user_metadata?.avatar_url} />
                    <AvatarFallback className="text-xs">{initial}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => navigate({ to: "/me" })}>My profile</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/instant" })}>
                  <Radio className="mr-2 h-4 w-4" /> Drop into Workshop
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/collab/new" })}>
                  <Megaphone className="mr-2 h-4 w-4" /> Post a Collab
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

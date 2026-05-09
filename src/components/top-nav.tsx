import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, Radio, Megaphone } from "lucide-react";

export function TopNav() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const initial =
    (user?.user_metadata?.display_name as string | undefined)?.[0] ??
    user?.email?.[0]?.toUpperCase() ??
    "·";

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 md:px-6">
        <Link to="/" className="flex items-center gap-2 font-display text-xl tracking-tight text-ink">
          <span className="inline-block h-2.5 w-2.5 rounded-full gradient-warm" />
          Workshop
        </Link>

        <nav className="ml-6 hidden items-center gap-1 md:flex">
          <Link to="/" className="rounded-full px-3 py-1.5 text-sm text-ink-soft hover:bg-muted transition" activeOptions={{ exact: true }}>Gallery</Link>
          <Link to="/workshops" className="rounded-full px-3 py-1.5 text-sm text-ink-soft hover:bg-muted transition">Workshops</Link>
          <Link to="/instant" className="rounded-full px-3 py-1.5 text-sm text-ink-soft hover:bg-muted transition">Instant</Link>
          <Link to="/collab" className="rounded-full px-3 py-1.5 text-sm text-ink-soft hover:bg-muted transition">Collab Board</Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link to="/workshops/new" className="hidden md:inline-flex">
            <Button size="sm" className="rounded-full gap-1.5">
              <Calendar className="h-4 w-4" /> Schedule a Workshop
            </Button>
          </Link>

          {loading ? null : user ? (
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
                <DropdownMenuItem onClick={() => navigate({ to: "/workshops/new" })}>
                  <Calendar className="mr-2 h-4 w-4" /> Schedule a Workshop
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/instant" })}>
                  <Radio className="mr-2 h-4 w-4" /> Join Instant
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/collab/new" })}>
                  <Megaphone className="mr-2 h-4 w-4" /> Post a Collab
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

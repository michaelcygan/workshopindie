import { Link, useNavigate } from "@tanstack/react-router";
import { Radio, Users, LayoutGrid, MapPin, Megaphone } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const tabBase =
  "flex flex-col items-center justify-center gap-0.5 rounded-full px-2 py-1 text-[10px] font-medium text-ink-muted transition";
const tabActive =
  "flex flex-col items-center justify-center gap-0.5 rounded-full px-2 py-1 text-[10px] font-medium text-ink bg-muted";

export function MobileNav() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const initial =
    (user?.user_metadata?.display_name as string | undefined)?.[0] ??
    user?.email?.[0]?.toUpperCase() ??
    "·";

  return (
    <div className="fixed inset-x-0 bottom-3 z-50 flex justify-center px-3 md:hidden">
      <div className="relative flex w-full max-w-md items-center gap-1 rounded-full border border-border/70 bg-background/90 px-2 py-1.5 shadow-lg backdrop-blur-md">
        <Link to="/" activeOptions={{ exact: true }} className={tabBase} activeProps={{ className: tabActive }}>
          <LayoutGrid className="h-5 w-5" />
          <span>Gallery</span>
        </Link>
        <Link to="/instant" className={tabBase} activeProps={{ className: tabActive }}>
          <Radio className="h-5 w-5" />
          <span>Workshop</span>
        </Link>

        {/* Center FAB spacer */}
        <div className="w-14 shrink-0" aria-hidden />

        <Link to="/collab" className={tabBase} activeProps={{ className: tabActive }}>
          <Users className="h-5 w-5" />
          <span>Collab</span>
        </Link>
        <Link to="/cities" className={tabBase} activeProps={{ className: tabActive }}>
          <MapPin className="h-5 w-5" />
          <span>Cities</span>
        </Link>

        {/* Right edge avatar / sign in */}
        <div className="ml-1 flex items-center">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center rounded-full ring-1 ring-border hover:ring-border-strong transition">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.user_metadata?.avatar_url} />
                    <AvatarFallback className="text-xs">{initial}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-52">
                <DropdownMenuItem onClick={() => navigate({ to: "/me" })}>My profile</DropdownMenuItem>
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
            <Link to="/login" className="rounded-full px-2 py-1 text-xs text-ink-soft">
              Sign in
            </Link>
          )}
        </div>

        {/* Center FAB */}
        <Link
          to="/collab/new"
          aria-label="Post a Collab"
          className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full gradient-motion text-primary-foreground shadow-xl ring-4 ring-background">
            <Megaphone className="h-6 w-6" />
          </span>
        </Link>
      </div>
    </div>
  );
}

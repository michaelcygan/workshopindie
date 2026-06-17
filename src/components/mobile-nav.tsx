import { Link, useNavigate } from "@tanstack/react-router";
import { Radio, Users, LayoutGrid, Sparkles, Megaphone, Gift, Briefcase, Mail } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const tabBase =
  "flex flex-1 basis-0 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1.5 text-[10px] font-medium text-ink-muted transition-colors hover:text-ink";
const tabActive =
  "flex flex-1 basis-0 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1.5 text-[10px] font-semibold text-ink bg-muted";

export function MobileNav() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const initial =
    (user?.user_metadata?.display_name as string | undefined)?.[0]?.toUpperCase() ??
    user?.email?.[0]?.toUpperCase() ??
    "·";

  return (
    <div className="fixed inset-x-0 bottom-3 z-50 flex justify-center px-3 md:hidden">
      <div className="flex w-full max-w-md items-stretch gap-0.5 rounded-full border border-border/70 bg-background/90 px-2 py-1.5 shadow-lg backdrop-blur-md">
        <Link to="/workshop" className={tabBase} activeProps={{ className: tabActive }}>
          <Radio className="h-[18px] w-[18px]" />
          <span>Workshop</span>
        </Link>
        <Link to="/collab" className={tabBase} activeProps={{ className: tabActive }}>
          <Users className="h-[18px] w-[18px]" />
          <span>Collab</span>
        </Link>
        <Link to="/gallery" className={tabBase} activeProps={{ className: tabActive }}>
          <LayoutGrid className="h-[18px] w-[18px]" />
          <span>Work</span>
        </Link>
        <Link to="/groups" className={tabBase} activeProps={{ className: tabActive }}>
          <Sparkles className="h-[18px] w-[18px]" />
          <span>Groups</span>
        </Link>

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
            <DropdownMenuContent align="end" side="top" className="w-52">
              <DropdownMenuItem onClick={() => navigate({ to: "/me" })}>My profile</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/dms" })}>
                <Mail className="mr-2 h-4 w-4" /> Messages
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/me/collabs" })}>
                <Briefcase className="mr-2 h-4 w-4" /> My Collabs
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/collab/new" })}>
                <Megaphone className="mr-2 h-4 w-4" /> Post a Collab
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/refer" })}>
                <Gift className="mr-2 h-4 w-4" /> Refer & Earn
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

import { Link } from "@tanstack/react-router";
import { Radio, Users, Sparkles, Home } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useInProgressBadge } from "@/hooks/use-in-progress-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const tabBase =
  "relative flex flex-1 basis-0 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1.5 text-[10px] font-medium text-ink-muted transition-colors hover:text-ink";
const tabActive =
  "relative flex flex-1 basis-0 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1.5 text-[10px] font-semibold text-ink bg-muted";

export function MobileNav() {
  const { user } = useAuth();
  const { count } = useInProgressBadge();

  const initial =
    ((user?.user_metadata?.display_name as string | undefined) ??
      user?.email?.split("@")[0] ??
      "·")[0]?.toUpperCase() ?? "·";

  return (
    <div className="pointer-events-auto fixed inset-x-0 bottom-3 z-[65] flex justify-center px-3 md:hidden">
      <div className="flex w-full max-w-md items-stretch gap-0.5 rounded-full border border-border/70 bg-background/90 px-2 py-1.5 shadow-lg backdrop-blur-md">
        <Link to="/" className={tabBase} activeProps={{ className: tabActive }} activeOptions={{ exact: true }}>
          <Home className="h-[18px] w-[18px]" />
          <span>Home</span>
        </Link>
        <Link to="/lounge" className={tabBase} activeProps={{ className: tabActive }}>
          <Radio className="h-[18px] w-[18px]" />
          <span>Lounge</span>
        </Link>
        <Link to="/collab" className={tabBase} activeProps={{ className: tabActive }}>
          <Users className="h-[18px] w-[18px]" />
          <span>Collabs</span>
        </Link>
        <Link to="/groups" className={tabBase} activeProps={{ className: tabActive }}>
          <Sparkles className="h-[18px] w-[18px]" />
          <span>Groups</span>
        </Link>

        {user ? (
          <Link to="/me" className={tabBase} activeProps={{ className: tabActive }} aria-label="Your profile">
            <span className="relative inline-flex">
              <Avatar className="h-[18px] w-[18px]">
                <AvatarImage src={user.user_metadata?.avatar_url} />
                <AvatarFallback className="text-[9px]">{initial}</AvatarFallback>
              </Avatar>
              {count > 0 && (
                <span
                  aria-label={`${count} in progress`}
                  className="absolute -right-1 -top-1 inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold leading-none text-primary-foreground ring-2 ring-background"
                >
                  {count > 9 ? "9+" : count}
                </span>
              )}
            </span>
            <span>You</span>
          </Link>
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

import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import type { Friend } from "@/lib/friends.functions";
import { cn } from "@/lib/utils";

type Props = {
  friend: Friend;
  /** Render an action button (Invite to Workshop, etc.) on the right side. */
  action?: React.ReactNode;
  onInviteClick?: () => void;
  inviteLabel?: string;
  inviteDisabled?: boolean;
};

export function FriendRow({ friend, action, onInviteClick, inviteLabel = "Invite", inviteDisabled }: Props) {
  const initial = (friend.display_name ?? friend.username ?? "?").charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
      <Link
        to="/u/$username"
        params={{ username: friend.username ?? friend.user_id }}
        className="relative shrink-0"
        aria-label={`Open ${friend.display_name ?? friend.username ?? "profile"}`}
      >
        <Avatar className="h-10 w-10">
          <AvatarImage src={friend.avatar_url ?? undefined} alt="" />
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface",
            friend.online ? "bg-emerald-500" : "bg-muted-foreground/30",
          )}
          aria-label={friend.online ? "Online" : "Offline"}
        />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to="/u/$username"
          params={{ username: friend.username ?? friend.user_id }}
          className="block truncate text-sm font-medium text-ink hover:underline"
        >
          {friend.display_name ?? friend.username ?? "Unnamed"}
        </Link>
        <div className="truncate text-xs text-ink-muted">
          {friend.online ? (
            <span className="text-emerald-600">Online now</span>
          ) : (
            friend.headline ?? (friend.username ? `@${friend.username}` : "")
          )}
        </div>
      </div>
      {action ?? (
        onInviteClick && (
          <Button size="sm" variant="outline" onClick={onInviteClick} disabled={inviteDisabled}>
            <UserPlus className="mr-1.5 h-3.5 w-3.5" />
            {inviteLabel}
          </Button>
        )
      )}
    </div>
  );
}

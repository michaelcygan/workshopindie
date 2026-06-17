import { Link } from "@tanstack/react-router";
import { ChevronDown, MapPin, Sparkles, Users } from "lucide-react";
import { useMyGroups } from "@/hooks/use-my-groups";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

/**
 * Top-nav "Groups" entry. Shows a dropdown of the viewer's joined groups
 * (when any) plus a link to browse all. For logged-out users or users
 * with zero memberships, behaves as a plain link to /groups.
 */
export function GroupsNavItem() {
  const { data: groups } = useMyGroups();
  const baseLink =
    "rounded-full px-3 py-1.5 text-sm text-ink-soft hover:bg-muted transition";
  const activeLink = "rounded-full px-3 py-1.5 text-sm text-ink bg-muted";

  if (!groups || groups.length === 0) {
    return (
      <Link
        to="/groups"
        className={baseLink}
        activeProps={{ className: activeLink }}
      >
        Groups
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={`${baseLink} inline-flex items-center gap-1`}>
          Groups
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-60">
        <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          Your groups
        </DropdownMenuLabel>
        {groups.slice(0, 8).map((g) => {
          const Icon = g.kind === "city" ? MapPin : Sparkles;
          return (
            <DropdownMenuItem key={g.id} asChild>
              <Link to="/g/$slug" params={{ slug: g.slug }} className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-ink-muted" />
                <span className="truncate">{g.name}</span>
                <span className="ml-auto text-[10px] text-ink-muted">{g.member_count}</span>
              </Link>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/groups" className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5" />
            Browse all groups
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { Link } from "@tanstack/react-router";
import { Calendar, Info, LayoutGrid, Megaphone, Plus, Radio, Sparkles, Sun, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type GroupTab =
  | "today"
  | "events"
  | "workshops"
  | "collab"
  | "work"
  | "members"
  | "subgroups"
  | "about";

export function GroupTabBar({
  tab,
  setTab,
  slug,
  counts,
  childCount,
}: {
  tab: GroupTab;
  setTab: (t: GroupTab) => void;
  slug: string;
  counts: { collab: number; work: number; workshops: number; members: number };
  childCount: number;
}) {
  const items: { id: GroupTab; label: string; icon: typeof LayoutGrid; count: number | null }[] = [
    { id: "today", label: "Today", icon: Sun, count: null },
    { id: "collab", label: "Collabs", icon: Megaphone, count: counts.collab },
    { id: "work", label: "Work", icon: LayoutGrid, count: counts.work },
    { id: "workshops", label: "Workshops", icon: Radio, count: counts.workshops },
    { id: "events", label: "Events", icon: Calendar, count: null },
    ...(childCount > 0
      ? [{ id: "subgroups" as const, label: "Groups", icon: Sparkles, count: childCount }]
      : []),
    { id: "members", label: "Members", icon: Users, count: counts.members },
    { id: "about", label: "About", icon: Info, count: null },
  ];

  return (
    // Outer: sticky, no overflow — overscroll can't pull this out of place.
    <div className="sticky top-14 z-20 -mx-4 border-b border-border bg-background/85 px-4 backdrop-blur md:-mx-6 md:px-6">
      <div className="flex items-center gap-1.5">
        {/* Inner: horizontal scroller, isolated from vertical rubber-band */}
        <div className="flex flex-1 items-center gap-1.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((t) => {
            const TIcon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition",
                  active
                    ? "border-ink text-ink"
                    : "border-transparent text-ink-muted hover:text-ink",
                )}
              >
                <TIcon className="h-4 w-4" />
                {t.label}
                {t.count !== null && (
                  <span className="text-[11px] text-ink-muted/80">{t.count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Trailing create menu — pinned outside the horizontal scroller. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 gap-1 rounded-full"
              aria-label="Create in this group"
            >
              <Plus className="h-4 w-4" /> Create
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem asChild>
              <Link to="/collab/new" search={{ group: slug }}>
                New Collab
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/works/new" search={{ group: slug }}>
                New Work
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/workshops/new" search={{ group: slug }}>
                New Workshop
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

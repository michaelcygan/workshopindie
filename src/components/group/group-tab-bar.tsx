import { useEffect, useRef } from "react";
import { BookMarked, Calendar, ChevronDown, FileText, Info, LayoutGrid, Link2, Megaphone, Sparkles, Sun, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Internal tab keys are legacy and stable (`work`, `posts`, `resources`,
 * `subgroups`) so every existing `?t=` deep link keeps resolving. Only the
 * visible labels changed: Gallery, Blog, Resources, Groups.
 */
export type GroupTab =
  | "today"
  | "events"
  | "collab"
  | "work"
  | "links"
  | "posts"
  | "resources"
  | "members"
  | "subgroups"
  | "about";

type Item = {
  id: GroupTab;
  label: string;
  hint: string;
  icon: typeof LayoutGrid;
  count: number | null;
};

export function GroupTabBar({
  tab,
  setTab,
  counts,
  childCount,
  isAuthed,
  showPosts = true,
  showResources = false,
  showLinks = false,
  todayUnread = 0,
}: {
  tab: GroupTab;
  setTab: (t: GroupTab) => void;
  slug?: string;
  counts: {
    collab: number;
    work: number;
    members: number;
    events: number;
    posts: number;
    resources: number;
    links: number;
  };
  childCount: number;
  /** Members is a signed-in-only directory. */
  isAuthed: boolean;
  /** Hide the Blog tab when the Group has no tagged or member-authored posts. */
  showPosts?: boolean;
  /** Hide the Resources tab entirely until the Group has published resources. */
  showResources?: boolean;
  /** Links is a projection of Today; it only appears once links exist. */
  showLinks?: boolean;
  /** Unseen Today messages for this visitor; 0 hides the dot. */
  todayUnread?: number;
}) {
  // One ordered spine: Today · Collabs · Events · Gallery · Blog · Members ·
  // Resources, then the two secondary sections. Omitted sections never
  // reorder the rest.
  const items: Item[] = [
    { id: "today", label: "Today", hint: "What's happening right now", icon: Sun, count: null },
    { id: "collab", label: "Collabs", hint: "Who needs people", icon: Megaphone, count: counts.collab },
    { id: "events", label: "Events", hint: "Where to go", icon: Calendar, count: counts.events },
    { id: "work", label: "Gallery", hint: "What the scene makes", icon: LayoutGrid, count: counts.work },
    ...(showPosts
      ? [{ id: "posts" as const, label: "Blog", hint: "What the scene writes", icon: FileText, count: counts.posts }]
      : []),
    ...(isAuthed
      ? [{ id: "members" as const, label: "Members", hint: "Who is in the room", icon: Users, count: counts.members }]
      : []),
    ...(showResources
      ? [{ id: "resources" as const, label: "Resources", hint: "Places, services, organizations", icon: BookMarked, count: counts.resources }]
      : []),
    ...(showLinks
      ? [{ id: "links" as const, label: "Links", hint: "What the room is sharing", icon: Link2, count: counts.links }]
      : []),
    { id: "about", label: "About", hint: "What this Group is", icon: Info, count: null },
    ...(childCount > 0
      ? [{ id: "subgroups" as const, label: "Groups", hint: "More specific rooms", icon: Sparkles, count: childCount }]
      : []),
  ];

  const scrollerRef = useRef<HTMLDivElement>(null);

  // Bring the active label into view without dragging the page sideways.
  useEffect(() => {
    const el = scrollerRef.current?.querySelector<HTMLElement>(`[data-tab="${tab}"]`);
    el?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [tab]);

  return (
    // Outer: sticky, no overflow — overscroll can't pull this out of place.
    // Top offset matches the mobile brand header (44px) and desktop nav (56px).
    <div className="sticky top-11 z-20 -mx-4 border-b border-border bg-background/85 px-4 backdrop-blur md:-mx-6 md:top-14 md:px-6">
      <div className="flex items-center gap-1">
        {/* Inner: horizontal scroller, isolated from vertical rubber-band */}
        <div
          ref={scrollerRef}
          role="tablist"
          aria-label="Group sections"
          className="flex flex-1 items-center gap-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((t) => {
            const TIcon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                data-tab={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-current={active ? "page" : undefined}
                onClick={() => setTab(t.id)}
                className={cn(
                  "-mb-px flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition",
                  active
                    ? "border-ink text-ink"
                    : "border-transparent text-ink-muted hover:text-ink",
                )}
              >
                <TIcon className="hidden h-4 w-4 sm:block" />
                {t.label}
                {t.count !== null && t.count > 0 && (
                  <span className="text-[11px] text-ink-muted/80">{t.count}</span>
                )}
                {t.id === "today" && todayUnread > 0 && (
                  <span
                    aria-label={`${todayUnread} new message${todayUnread === 1 ? "" : "s"}`}
                    className="grid h-4 min-w-4 place-items-center rounded-full bg-signal px-1 text-[10px] font-semibold leading-none text-signal-foreground"
                  >
                    {todayUnread > 9 ? "9+" : todayUnread}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Trailing "All sections" menu — swiping is never the only way to navigate. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="All sections"
              className="grid h-11 w-9 shrink-0 place-items-center rounded-md text-ink-soft transition hover:bg-surface-2 hover:text-ink"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {items.map((t) => (
              <DropdownMenuItem
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex-col items-start gap-0.5"
              >
                <span className={cn("text-sm", tab === t.id ? "font-semibold text-ink" : "text-ink")}>
                  {t.label}
                </span>
                <span className="text-[11px] text-ink-muted">{t.hint}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

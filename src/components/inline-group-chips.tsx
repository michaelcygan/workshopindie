import { Link } from "@tanstack/react-router";
import { MapPin, Sparkles } from "lucide-react";
import type { GroupTag } from "@/hooks/use-group-tags";
import { cn } from "@/lib/utils";

/**
 * Small group chips rendered inline on a feed card. Click navigates to /g/$slug.
 * Highlights chips for groups the viewer has joined.
 */
export function InlineGroupChips({
  groups,
  myGroupIds,
  max = 2,
  className,
}: {
  groups: GroupTag[] | undefined;
  myGroupIds?: Set<string>;
  max?: number;
  className?: string;
}) {
  if (!groups || groups.length === 0) return null;
  // Prefer chips the viewer belongs to.
  const sorted = groups
    .slice()
    .sort((a, b) => Number(myGroupIds?.has(b.id) ?? 0) - Number(myGroupIds?.has(a.id) ?? 0));
  const shown = sorted.slice(0, max);
  const overflow = sorted.length - shown.length;
  return (
    <div className={cn("relative z-20 flex flex-wrap items-center gap-1", className)}>
      {shown.map((g) => {
        const mine = myGroupIds?.has(g.id);
        const Icon = g.kind === "city" ? MapPin : Sparkles;
        return (
          <Link
            key={g.id}
            to="/g/$slug"
            params={{ slug: g.slug }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "inline-flex max-w-[10rem] items-center gap-1 truncate rounded-full px-2 py-0.5 text-[10px] font-medium transition",
              mine
                ? "bg-primary/10 text-primary hover:bg-primary/15"
                : "bg-muted text-ink-soft hover:bg-surface-2 hover:text-ink",
            )}
            title={g.name}
          >
            <Icon className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{g.name}</span>
          </Link>
        );
      })}
      {overflow > 0 && (
        <span className="text-[10px] text-ink-muted">+{overflow}</span>
      )}
    </div>
  );
}

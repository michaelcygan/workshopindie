import { Link } from "@tanstack/react-router";
import { MapPin, Sparkles, ArrowRight } from "lucide-react";
import { useMyGroups } from "@/hooks/use-my-groups";
import { cn } from "@/lib/utils";

/**
 * Horizontal pill strip of the viewer's joined groups.
 * Renders nothing for logged-out users or users with zero memberships.
 */
export function YourGroupsStrip({ className }: { className?: string }) {
  const { data, isLoading } = useMyGroups();
  if (isLoading) return null;
  if (!data || data.length === 0) return null;

  return (
    <div className={cn("border-b border-border/60 bg-surface/40", className)}>
      <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-2.5 md:px-6 [scrollbar-width:thin]">
        <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          Your groups
        </span>
        {data.map((g) => {
          const Icon = g.kind === "city" ? MapPin : Sparkles;
          return (
            <Link
              key={g.id}
              to="/g/$slug"
              params={{ slug: g.slug }}
              className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs text-ink-soft shadow-soft transition hover:bg-muted hover:text-ink"
            >
              <Icon className="h-3 w-3 text-ink-muted group-hover:text-ink" />
              <span className="font-medium">{g.name}</span>
            </Link>
          );
        })}
        <Link
          to="/groups"
          className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs text-ink-muted hover:text-ink"
        >
          Browse all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

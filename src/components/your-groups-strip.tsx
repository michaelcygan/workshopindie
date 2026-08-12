import { Link } from "@tanstack/react-router";
import { MapPin, Sparkles, ArrowRight } from "lucide-react";
import { useMyGroups } from "@/hooks/use-my-groups";
import { cn } from "@/lib/utils";

/**
 * Horizontal pill strip of the viewer's joined groups.
 * Renders nothing for logged-out users or users with zero memberships.
 *
 * `variant="inline"` drops the surrounding band so the strip can live inside
 * another header block without stacking a second border/padding row.
 */
export function YourGroupsStrip({
  className,
  variant = "band",
}: {
  className?: string;
  variant?: "band" | "inline";
}) {
  const { data, isLoading } = useMyGroups();
  if (isLoading) return null;
  if (!data || data.length === 0) return null;

  const inline = variant === "inline";

  const rail = (
    <div
      className={cn(
        "flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        inline ? "snap-x" : "mx-auto max-w-7xl px-4 py-2.5 md:px-6",
      )}
    >
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
            className="group inline-flex shrink-0 snap-start items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs text-ink-soft shadow-soft transition hover:bg-muted hover:text-ink"
          >
            <Icon className="h-3 w-3 text-ink-muted group-hover:text-ink" />
            <span className="font-medium">{g.name}</span>
          </Link>
        );
      })}
      <Link
        to="/groups"
        className="ml-auto inline-flex shrink-0 items-center gap-1 pl-2 text-xs text-ink-muted hover:text-ink"
      >
        Browse all <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );

  if (inline) return <div className={cn("min-w-0", className)}>{rail}</div>;

  return <div className={cn("border-b border-border/60 bg-surface/40", className)}>{rail}</div>;
}

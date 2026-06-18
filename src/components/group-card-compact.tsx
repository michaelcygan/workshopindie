import { Link } from "@tanstack/react-router";
import { MapPin, Sparkles, Users } from "lucide-react";
import type { GroupCardData } from "@/components/group-card";

function accentBg(color: string | null) {
  const base = color ?? "#c2410c";
  return { backgroundImage: `linear-gradient(135deg, ${base}, ${base}99)` } as React.CSSProperties;
}

/** Compact group chip used in horizontal rails and kind cluster previews. */
export function GroupCardCompact({ group, joined }: { group: GroupCardData; joined?: boolean }) {
  const Icon = group.kind === "city" ? MapPin : Sparkles;
  return (
    <Link
      to="/g/$slug"
      params={{ slug: group.slug }}
      className="group flex items-center gap-3 rounded-2xl border border-border bg-surface p-2.5 pr-3.5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div
        className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl text-white"
        style={accentBg(group.accent_color)}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h4 className="truncate font-display text-[15px] leading-tight text-ink">{group.name}</h4>
          {joined && (
            <span className="rounded-full bg-ink px-1.5 py-0.5 text-[9px] font-medium text-background">In</span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-muted">
          <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{group.member_count}</span>
          {group.tagline && <span className="truncate">· {group.tagline}</span>}
        </div>
      </div>
    </Link>
  );
}

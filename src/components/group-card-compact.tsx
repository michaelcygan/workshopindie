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
      className="group flex items-center gap-2 rounded-2xl border border-border bg-surface p-2 pr-3 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div
        className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg text-white"
        style={accentBg(group.accent_color)}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <h4 className="truncate font-display text-[13px] leading-tight text-ink">{group.name}</h4>
        {joined && (
          <span className="shrink-0 rounded-full bg-ink px-1 py-0.5 text-[9px] font-medium text-background">In</span>
        )}
      </div>
      <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] text-ink-muted">
        <Users className="h-2.5 w-2.5" />
        {group.member_count}
      </span>
    </Link>
  );
}

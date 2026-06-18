import { Link } from "@tanstack/react-router";
import { MapPin, Sparkles, Zap, Flame, Users } from "lucide-react";
import type { GroupCardData } from "@/components/group-card";
import { LiveDot } from "@/components/live-dot";

type Kind = GroupCardData["kind"];

const KIND_ICON: Record<Kind, typeof MapPin> = {
  city: MapPin,
  genre: Sparkles,
  micro: Zap,
  scene: Flame,
};

type Props = {
  groups: GroupCardData[];
  joinedIds: Set<string>;
};

/**
 * Numbered chart-style list: 01, 02, 03... with accent stripe and kind glyph.
 * Replaces the older identical-pill rail to read as a chart, not another grid.
 */
export function GroupsTrendingList({ groups, joinedIds }: Props) {
  if (groups.length === 0) return null;
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <div className="flex items-center gap-2">
          <LiveDot live />
          <h2 className="font-display text-lg text-ink">Trending now</h2>
        </div>
        <span className="text-xs text-ink-muted">Most active this week</span>
      </div>
      <ol className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {groups.map((g, i) => {
          const KIcon = KIND_ICON[g.kind];
          const accent = g.accent_color ?? "#c2410c";
          const joined = joinedIds.has(g.id);
          return (
            <li key={g.id}>
              <Link
                to="/g/$slug"
                params={{ slug: g.slug }}
                className="group flex items-center gap-3 rounded-2xl border border-transparent bg-surface px-3 py-2.5 transition hover:border-border hover:shadow-soft"
              >
                <span
                  aria-hidden
                  className="font-mono text-xs tabular-nums text-ink-muted/70 group-hover:text-ink-soft"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  aria-hidden
                  className="h-8 w-1 shrink-0 rounded-full"
                  style={{ backgroundColor: accent }}
                />
                <KIcon className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                <span className="min-w-0 flex-1 truncate font-display text-[15px] text-ink">
                  {g.name}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-ink-muted">
                  <Users className="h-3 w-3" /> {g.member_count}
                </span>
                {joined && (
                  <span className="rounded-full bg-ink px-1.5 py-0.5 text-[9px] font-medium text-background">
                    In
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

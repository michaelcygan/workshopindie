import { Link } from "@tanstack/react-router";
import type { GroupCardData } from "@/components/group-card";
import { Sparkles, Users } from "lucide-react";

type Props = {
  groups: GroupCardData[];
  title?: string;
  /** seconds per loop; lower = faster */
  speed?: number;
};

/**
 * Ambient vertical marquee — slowly scrolls a column of group chips upward.
 * Fills tall sidebar space with motion. Pauses on hover. Each row links to /g/$slug.
 */
export function GroupsVerticalMarquee({ groups, title = "Fresh in", speed = 60 }: Props) {
  if (groups.length === 0) return null;
  const loop = [...groups, ...groups];
  return (
    <section className="rounded-3xl border border-border bg-surface p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-ink-muted" />
          <h3 className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-muted">
            {title}
          </h3>
        </div>
        <span className="text-[10px] text-ink-muted/70">drifting</span>
      </div>
      <div
        className="group relative h-[360px] overflow-hidden"
        style={{
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0, black 8%, black 92%, transparent 100%)",
          maskImage:
            "linear-gradient(to bottom, transparent 0, black 8%, black 92%, transparent 100%)",
        }}
        aria-label={`${title} ambient feed`}
      >
        <ul
          className="flex flex-col gap-2 will-change-transform group-hover:[animation-play-state:paused] motion-reduce:animation-none"
          style={{ animation: `groups-vmarquee ${speed}s linear infinite` }}
        >
          {loop.map((g, i) => (
            <li key={`${g.id}-${i}`}>
              <Link
                to="/g/$slug"
                params={{ slug: g.slug }}
                className="group/row flex items-center gap-2.5 rounded-xl border border-transparent bg-background px-2.5 py-2 transition hover:border-border hover:shadow-soft"
              >
                <span
                  aria-hidden
                  className="h-7 w-1 shrink-0 rounded-full"
                  style={{ backgroundColor: g.accent_color ?? "#c2410c" }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-ink">{g.name}</div>
                  {g.tagline && (
                    <div className="truncate text-[11px] text-ink-muted">{g.tagline}</div>
                  )}
                </div>
                <span className="flex items-center gap-1 text-[10px] text-ink-muted">
                  <Users className="h-3 w-3" />
                  {g.member_count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <style>{`
          @keyframes groups-vmarquee {
            from { transform: translate3d(0, 0, 0); }
            to   { transform: translate3d(0, -50%, 0); }
          }
        `}</style>
      </div>
    </section>
  );
}

import { Link } from "@tanstack/react-router";
import type { GroupCardData } from "@/components/group-card";

type Props = { groups: GroupCardData[] };

/**
 * Ambient horizontal marquee of group names with their accent dot.
 * Drifts slowly, pauses on hover, fades at the edges. Decorative only —
 * each item is still a real link.
 */
export function SceneTicker({ groups }: Props) {
  if (groups.length === 0) return null;
  // Repeat enough copies that one half of the loop is always wider than the
  // viewport, so the -50% translate restart is invisible. Must stay even.
  const minItems = 40;
  let copies = Math.max(2, Math.ceil(minItems / groups.length));
  if (copies % 2 !== 0) copies += 1;
  const loop = Array.from({ length: copies }).flatMap(() => groups);

  return (
    <div
      className="group relative overflow-hidden"
      style={{
        WebkitMaskImage:
          "linear-gradient(to right, transparent 0, black 6%, black 94%, transparent 100%)",
        maskImage:
          "linear-gradient(to right, transparent 0, black 6%, black 94%, transparent 100%)",
      }}
      aria-label="Scenes ticker"
    >
      <div
        className="scene-ticker-track flex w-max items-center gap-6 whitespace-nowrap py-2 motion-reduce:animation-none"
      >
        {loop.map((g, i) => (
          <Link
            key={`${g.id}-${i}`}
            to="/g/$slug"
            params={{ slug: g.slug }}
            className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-ink-muted transition hover:text-ink"
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: g.accent_color ?? "#c2410c" }}
            />
            <span className="font-medium">{g.name}</span>
            <span aria-hidden className="text-ink-muted/40">·</span>
          </Link>
        ))}
      </div>
      <style>{`
        @keyframes scene-ticker {
          from { transform: translate3d(0, 0, 0); }
          to   { transform: translate3d(-50%, 0, 0); }
        }
      `}</style>
    </div>
  );
}

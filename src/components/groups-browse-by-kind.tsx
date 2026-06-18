import { MapPin, Sparkles, Zap, Flame, ArrowRight } from "lucide-react";
import { GroupCardCompact } from "@/components/group-card-compact";
import type { GroupCardData } from "@/components/group-card";
import { cn } from "@/lib/utils";

type Kind = GroupCardData["kind"];

const KIND_META: Record<Kind, { label: string; blurb: string; icon: typeof MapPin }> = {
  city: { label: "Cities", blurb: "Where your scene meets in person.", icon: MapPin },
  genre: { label: "Genres", blurb: "Find your craft, find your peers.", icon: Sparkles },
  scene: { label: "Scenes", blurb: "Aesthetics, eras, vibes.", icon: Flame },
  micro: { label: "Micro", blurb: "Short sprints. Shipping crews.", icon: Zap },
};

type Props = {
  groups: GroupCardData[];
  joinedIds: Set<string>;
  onJump: (kind: Kind) => void;
};

export function GroupsBrowseByKind({ groups, joinedIds, onJump }: Props) {
  const kinds: Kind[] = ["genre", "scene", "micro", "city"];
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h2 className="font-display text-xl text-ink md:text-2xl">Browse by kind</h2>
        <span className="text-xs text-ink-muted">Four flavors of room</span>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {kinds.map((k) => {
          const meta = KIND_META[k];
          const KIcon = meta.icon;
          const sample = groups.filter((g) => g.kind === k).slice(0, 4);
          if (sample.length === 0) return null;
          return (
            <div
              key={k}
              className={cn(
                "flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4 shadow-soft",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-ink-soft">
                    <KIcon className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="font-display text-lg text-ink leading-none">{meta.label}</h3>
                    <p className="mt-1 text-xs text-ink-muted">{meta.blurb}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onJump(k)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-ink-muted transition hover:bg-muted hover:text-ink"
                >
                  See all <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {sample.map((g) => (
                  <GroupCardCompact key={g.id} group={g} joined={joinedIds.has(g.id)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

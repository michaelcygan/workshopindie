import { GroupCardCompact } from "@/components/group-card-compact";
import type { GroupCardData } from "@/components/group-card";
import { LiveDot } from "@/components/live-dot";

type Props = {
  groups: GroupCardData[];
  joinedIds: Set<string>;
};

export function GroupsTrendingRail({ groups, joinedIds }: Props) {
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
      <div className="-mx-4 grid auto-cols-[minmax(240px,1fr)] grid-flow-col gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0 [scrollbar-width:thin]">
        {groups.map((g) => (
          <GroupCardCompact key={g.id} group={g} joined={joinedIds.has(g.id)} />
        ))}
      </div>
    </section>
  );
}

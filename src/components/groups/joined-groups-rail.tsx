import { Link } from "@tanstack/react-router";
import { MapPin, Sparkles } from "lucide-react";
import type { GroupCardData } from "@/components/group-card";

const KIND_LABEL: Record<GroupCardData["kind"], string> = {
  city: "City",
  genre: "Field",
  micro: "Micro",
  scene: "Scene",
};

function memberLabel(n: number) {
  if (n <= 0) return "New";
  return `${n.toLocaleString()} ${n === 1 ? "member" : "members"}`;
}

function coverStyle(g: GroupCardData) {
  const accent = g.accent_color ?? "#c2410c";
  return g.cover_url
    ? {
        backgroundImage: `url(${g.cover_url})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : {
        backgroundImage: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 55%, ${accent}66 100%)`,
      };
}

/** Small tile used in the horizontal joined-groups rail. */
function GroupTile({ group }: { group: GroupCardData }) {
  const Icon = group.kind === "city" ? MapPin : Sparkles;
  return (
    <Link
      to="/g/$slug"
      params={{ slug: group.slug }}
      className="group flex h-full w-[160px] shrink-0 snap-start flex-col overflow-hidden rounded-lg border border-border bg-surface transition hover:border-ink/30 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 sm:w-[190px]"
    >
      <div
        className="relative aspect-[16/10] w-full shrink-0 overflow-hidden lg:aspect-auto lg:min-h-0 lg:flex-1"
        style={coverStyle(group)}
      >
        {!group.cover_url && (
          <Icon className="absolute -bottom-2 -right-2 h-14 w-14 text-white/15" aria-hidden />
        )}
      </div>
      <div className="flex-none p-2.5">
        <p className="truncate text-sm font-medium text-ink group-hover:underline">{group.name}</p>
        <p className="mt-0.5 truncate text-[11px] text-ink-muted">
          {KIND_LABEL[group.kind]} · {memberLabel(group.member_count)}
        </p>
      </div>
    </Link>
  );
}


/** Compact sidebar row listing every joined group. */
function GroupRow({ group }: { group: GroupCardData }) {
  return (
    <Link
      to="/g/$slug"
      params={{ slug: group.slug }}
      className="group flex items-center gap-2.5 rounded-md px-2 py-1.5 transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
    >
      <span
        className="h-7 w-7 shrink-0 rounded-md border border-border"
        style={coverStyle(group)}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-ink group-hover:underline">{group.name}</span>
        <span className="block truncate text-[11px] text-ink-muted">
          {KIND_LABEL[group.kind]}
        </span>
      </span>
      <span className="shrink-0 text-[11px] tabular-nums text-ink-muted">
        {group.member_count.toLocaleString()}
      </span>
    </Link>
  );
}

/**
 * Joined groups: a compact one-row scroller of the most active scenes,
 * plus a scrollable sidebar list of everything you've joined.
 */
export function JoinedGroupsRail({
  groups,
  railGroups,
}: {
  groups: GroupCardData[];
  railGroups: GroupCardData[];
}) {
  return (
    <div className="grid gap-4 lg:h-[180px] lg:grid-cols-[minmax(0,1fr)_280px] lg:items-stretch">
      <div className="relative min-w-0 lg:h-full">
        <div className="-mx-4 flex h-full snap-x gap-3 overflow-x-auto overflow-y-hidden px-4 pb-2 md:mx-0 md:px-0 lg:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {railGroups.map((g) => (
            <GroupTile key={g.id} group={g} />
          ))}
        </div>
        {/* overflow cue */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-10 bg-gradient-to-l from-background to-transparent lg:block"
          aria-hidden
        />
      </div>

      <aside className="hidden flex-col overflow-hidden rounded-lg border border-border bg-surface p-2 lg:flex lg:h-full">
        <p className="flex-none px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          All groups
        </p>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]">
          {groups.map((g) => (
            <GroupRow key={g.id} group={g} />
          ))}
        </div>
      </aside>
    </div>
  );
}

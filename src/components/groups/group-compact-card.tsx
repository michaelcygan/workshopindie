import { Link } from "@tanstack/react-router";
import { MapPin, Sparkles } from "lucide-react";
import type { GroupCardData } from "@/components/group-card";
import { GroupCardActions } from "@/components/group-card-actions";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<GroupCardData["kind"], string> = {
  city: "City",
  genre: "Field",
  micro: "Micro",
  scene: "Scene",
};

function memberLabel(n: number) {
  if (n <= 0) return "Be among the first";
  return `${n.toLocaleString()} ${n === 1 ? "member" : "members"}`;
}

/**
 * Dense Group card for the mobile featured rail and the desktop featured grid.
 * Shorter cover than the editorial lead card so several scenes fit on screen.
 */
export function GroupCompactCard({
  group,
  joined,
  className,
}: {
  group: GroupCardData;
  joined?: boolean;
  className?: string;
}) {
  const accent = group.accent_color ?? "#c2410c";
  const Icon = group.kind === "city" ? MapPin : Sparkles;

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-soft transition hover:border-ink/30 hover:shadow-lift has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ink/30",
        className,
      )}
    >
      <Link
        to="/g/$slug"
        params={{ slug: group.slug }}
        className="absolute inset-0 z-0 focus:outline-none"
        aria-label={`Open ${group.name}`}
      />
      <div
        className="pointer-events-none relative aspect-[16/9] w-full overflow-hidden"
        style={
          group.cover_url
            ? {
                backgroundImage: `url(${group.cover_url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : {
                backgroundImage: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 55%, ${accent}66 100%)`,
              }
        }
      >
        {!group.cover_url && (
          <Icon className="absolute -bottom-3 -right-3 h-20 w-20 text-white/15" aria-hidden />
        )}
        <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-soft backdrop-blur">
          <Icon className="h-3 w-3" />
          {KIND_LABEL[group.kind]}
        </span>
        <div className="pointer-events-auto absolute right-2.5 top-2.5 z-10">
          <GroupCardActions groupId={group.id} joined={joined} />
        </div>
      </div>

      <div className="pointer-events-none relative z-0 flex flex-1 flex-col gap-1 p-3">
        <h3 className="font-display text-[15px] leading-snug text-ink line-clamp-2 group-hover:underline">
          {group.name}
        </h3>
        {group.tagline && (
          <p className="text-[12.5px] leading-snug text-ink-muted line-clamp-2">{group.tagline}</p>
        )}
        <p className="mt-auto pt-2 text-[11px] text-ink-muted">{memberLabel(group.member_count)}</p>
      </div>
    </article>
  );
}

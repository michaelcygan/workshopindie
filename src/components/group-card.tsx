import { Link } from "@tanstack/react-router";
import { MapPin, Sparkles, Users, Star, Radio, Megaphone, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { GroupCardActions } from "@/components/group-card-actions";

export type GroupCardData = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  kind: "city" | "genre" | "micro" | "scene";
  cover_url: string | null;
  avatar_url: string | null;
  accent_color: string | null;
  member_count: number;
  workshop_count: number;
  collab_count: number;
  work_count: number;
  is_official: boolean;
  featured_at: string | null;
  category?: string | null;
};


const kindLabel: Record<GroupCardData["kind"], string> = {
  city: "City",
  genre: "Genre",
  micro: "Micro",
  scene: "Scene",
};

function accentStyle(color: string | null) {
  const base = color ?? "#c2410c";
  return {
    backgroundImage: `linear-gradient(135deg, ${base} 0%, ${base}cc 55%, ${base}55 100%)`,
  } as React.CSSProperties;
}

export function GroupCard({
  group,
  joined,
  avatars,
}: {
  group: GroupCardData;
  joined?: boolean;
  avatars?: string[];
}) {
  const Icon = group.kind === "city" ? MapPin : Sparkles;
  const accent = group.accent_color ?? "#c2410c";
  return (
    <Link
      to="/g/$slug"
      params={{ slug: group.slug }}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
      style={{ boxShadow: `inset 0 0 0 1px ${accent}10` }}
    >
      <div
        className="relative h-20 w-full overflow-hidden"
        style={group.cover_url ? { backgroundImage: `url(${group.cover_url})`, backgroundSize: "cover", backgroundPosition: "center" } : accentStyle(group.accent_color)}
      >
        {/* top-light sheen */}
        {!group.cover_url && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 55%)",
            }}
          />
        )}
        {!group.cover_url && (
          <Icon className="absolute -bottom-2 -right-2 h-20 w-20 text-white/15" />
        )}
        <div className="absolute bottom-2 left-3 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-soft backdrop-blur">
            <Icon className="h-3 w-3" />
            {kindLabel[group.kind]}
          </span>
          {group.featured_at && (
            <span className="inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium text-primary backdrop-blur">
              <Star className="h-3 w-3" /> Featured
            </span>
          )}
        </div>
        {joined ? (
          <span className="absolute right-2 top-2 rounded-full bg-ink/90 px-1.5 py-0.5 text-[10px] font-medium text-background backdrop-blur">
            In
          </span>
        ) : (
          <GroupCardActions groupId={group.id} joined={joined} />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className={cn("font-display text-lg text-ink line-clamp-1")}>{group.name}</h3>
        {group.tagline && (
          <p className="text-sm text-ink-muted line-clamp-2">{group.tagline}</p>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          {avatars && avatars.length > 0 ? (
            <div className="flex -space-x-1.5">
              {avatars.slice(0, 3).map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt=""
                  className="h-5 w-5 rounded-full border border-surface object-cover"
                  loading="lazy"
                />
              ))}
            </div>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-muted">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" /> {group.member_count}
            </span>
            <span className="inline-flex items-center gap-1">
              <Radio className="h-3 w-3" /> {group.workshop_count}
            </span>
            <span className="inline-flex items-center gap-1">
              <Megaphone className="h-3 w-3" /> {group.collab_count}
            </span>
            <span className="inline-flex items-center gap-1">
              <LayoutGrid className="h-3 w-3" /> {group.work_count}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

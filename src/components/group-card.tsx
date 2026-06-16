import { Link } from "@tanstack/react-router";
import { MapPin, Sparkles, Users, Star } from "lucide-react";
import { cn } from "@/lib/utils";

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
};

const kindLabel: Record<GroupCardData["kind"], string> = {
  city: "City",
  genre: "Genre",
  micro: "Micro",
  scene: "Scene",
};

export function GroupCard({ group, joined }: { group: GroupCardData; joined?: boolean }) {
  const Icon = group.kind === "city" ? MapPin : Sparkles;
  return (
    <Link
      to="/g/$slug"
      params={{ slug: group.slug }}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div
        className={cn(
          "h-24 w-full",
          group.cover_url ? "bg-cover bg-center" : "gradient-motion",
        )}
        style={group.cover_url ? { backgroundImage: `url(${group.cover_url})` } : undefined}
      />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-soft">
            <Icon className="h-3 w-3" />
            {kindLabel[group.kind]}
          </span>
          {group.featured_at && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              <Star className="h-3 w-3" /> Featured
            </span>
          )}
          {joined && (
            <span className="ml-auto rounded-full bg-ink px-2 py-0.5 text-[10px] font-medium text-background">
              Joined
            </span>
          )}
        </div>
        <h3 className="font-display text-lg text-ink line-clamp-1">{group.name}</h3>
        {group.tagline && (
          <p className="text-sm text-ink-muted line-clamp-2">{group.tagline}</p>
        )}
        <div className="mt-auto flex items-center gap-3 pt-1 text-[11px] text-ink-muted">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" /> {group.member_count}
          </span>
          <span>· {group.workshop_count} Workshops</span>
          <span>· {group.collab_count} Collabs</span>
          <span>· {group.work_count} Work</span>
        </div>
      </div>
    </Link>
  );
}

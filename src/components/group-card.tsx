import { Link } from "@tanstack/react-router";
import { MapPin, Sparkles, Star } from "lucide-react";
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

const KIND_LABEL: Record<GroupCardData["kind"], string> = {
  city: "City",
  genre: "Genre",
  micro: "Micro",
  scene: "Scene",
};

function memberLabel(n: number) {
  if (n <= 0) return "Be among the first";
  if (n === 1) return "1 member";
  return `${n.toLocaleString()} members`;
}

function activityLabel(g: GroupCardData): string | null {
  const parts: string[] = [];
  if (g.work_count > 0) parts.push(`${g.work_count} ${g.work_count === 1 ? "work" : "works"}`);
  if (g.collab_count > 0)
    parts.push(`${g.collab_count} ${g.collab_count === 1 ? "collab" : "collabs"}`);
  if (g.workshop_count > 0)
    parts.push(`${g.workshop_count} ${g.workshop_count === 1 ? "Lounge" : "Lounges"}`);
  if (parts.length === 0) return null;
  return parts.slice(0, 2).join(" · ");
}

/**
 * Standard community-first Group card.
 * - No large decorative banner; accent color is used restrainedly.
 * - Header row: [avatar] KIND · FEATURED?, with visible Join action.
 * - Article wraps a content-only <Link>; the action is a sibling to avoid
 *   nested interactive descendants.
 */
export function GroupCard({
  group,
  joined,
  avatars,
}: {
  group: GroupCardData;
  joined?: boolean;
  avatars?: string[];
}) {
  const accent = group.accent_color ?? "#c2410c";
  const Icon = group.kind === "city" ? MapPin : Sparkles;
  const activity = activityLabel(group);

  return (
    <article
      className="group relative flex h-full flex-col rounded-2xl border border-border bg-surface p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
      style={{ boxShadow: `inset 0 0 0 1px ${accent}14` }}
    >
      {/* Header row: identity + featured chip + join */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        {group.avatar_url ? (
          <img
            src={group.avatar_url}
            alt=""
            loading="lazy"
            className="h-10 w-10 shrink-0 rounded-full border border-border object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white"
            style={{ backgroundColor: accent }}
          >
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div className="flex min-w-0 items-center gap-2 text-[11px] uppercase tracking-wider text-ink-muted">
          <span className="truncate">{KIND_LABEL[group.kind]}</span>
          {group.featured_at && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              <Star className="h-3 w-3" /> Featured
            </span>
          )}
        </div>
        <GroupCardActions groupId={group.id} joined={joined} className="shrink-0" />
      </div>

      {/* Content link — covers name, tagline, and footer for full-card nav */}
      <Link
        to="/g/$slug"
        params={{ slug: group.slug }}
        className="mt-3 flex flex-1 flex-col rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
        aria-label={`Open ${group.name}`}
      >
        <h3 className="font-display text-lg leading-snug text-ink line-clamp-2 group-hover:underline">
          {group.name}
        </h3>
        {group.tagline && (
          <p className="mt-1 text-sm text-ink-muted line-clamp-2">{group.tagline}</p>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-xs text-ink-muted">
          <div className="flex min-w-0 items-center gap-2">
            {avatars && avatars.length > 0 && (
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
            )}
            <span className="truncate">{memberLabel(group.member_count)}</span>
          </div>
          <span className={cn("shrink-0 text-right", !activity && "text-ink-muted/70")}>
            {activity ?? "New community"}
          </span>
        </div>
      </Link>
    </article>
  );
}

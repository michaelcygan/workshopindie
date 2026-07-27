import { Link } from "@tanstack/react-router";
import { MapPin, Sparkles, Star } from "lucide-react";
import type { GroupCardData } from "@/components/group-card";
import { GroupCardActions } from "@/components/group-card-actions";

const KIND_LABEL: Record<GroupCardData["kind"], string> = {
  city: "City",
  genre: "Genre",
  micro: "Micro",
  scene: "Scene",
};

/**
 * Editorial featured card — richer visual treatment reserved for the
 * Featured Groups rail. Uses cover imagery or accent gradient behind an
 * ~16:10 hero panel.
 */
export function GroupFeaturedCard({
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

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
      <div
        className="relative aspect-[16/10] w-full overflow-hidden"
        style={
          group.cover_url
            ? { backgroundImage: `url(${group.cover_url})`, backgroundSize: "cover", backgroundPosition: "center" }
            : { backgroundImage: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 55%, ${accent}66 100%)` }
        }
      >
        {!group.cover_url && (
          <Icon className="absolute -bottom-3 -right-3 h-24 w-24 text-white/15" aria-hidden />
        )}
        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-soft backdrop-blur">
            <Icon className="h-3 w-3" />
            {KIND_LABEL[group.kind]}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium text-primary backdrop-blur">
            <Star className="h-3 w-3" /> Featured
          </span>
        </div>
        <div className="absolute right-3 top-3">
          <GroupCardActions groupId={group.id} joined={joined} />
        </div>
      </div>

      <Link
        to="/g/$slug"
        params={{ slug: group.slug }}
        className="flex flex-1 flex-col gap-1.5 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
        aria-label={`Open ${group.name}`}
      >
        <h3 className="font-display text-xl leading-snug text-ink line-clamp-2 group-hover:underline">
          {group.name}
        </h3>
        {group.tagline && (
          <p className="text-sm text-ink-muted line-clamp-2">{group.tagline}</p>
        )}
        <div className="mt-auto flex items-center gap-2 pt-3 text-xs text-ink-muted">
          {avatars && avatars.length > 0 && (
            <div className="flex -space-x-1.5">
              {avatars.slice(0, 4).map((src, i) => (
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
          <span className="truncate">
            {group.member_count > 0
              ? `${group.member_count.toLocaleString()} ${group.member_count === 1 ? "member" : "members"}`
              : "Be among the first"}
          </span>
        </div>
      </Link>
    </article>
  );
}

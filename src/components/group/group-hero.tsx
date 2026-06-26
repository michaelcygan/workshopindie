import { Link, useRouter } from "@tanstack/react-router";
import { Calendar, MapPin, Radio, Share2, Sparkles, Star, Users } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { JoinGroupButton } from "@/components/join-group-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { joinGroupLounge } from "@/lib/instant.functions";

export type GroupHeroData = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  kind: "city" | "genre" | "micro" | "scene";
  cover_url: string | null;
  avatar_url: string | null;
  member_count: number;
  is_official: boolean;
  featured_at: string | null;
  parent: { id: string; slug: string; name: string } | null;
};

export function GroupHero({
  group,
  nextEvent,
}: {
  group: GroupHeroData;
  nextEvent: { slug: string; title: string; starts_at: string } | null | undefined;
}) {
  const Icon = group.kind === "city" ? MapPin : Sparkles;

  const onShare = async () => {
    const url = typeof window !== "undefined" ? `${window.location.origin}/g/${group.slug}` : "";
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: group.name, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <>
      {/* Hero band — title sits BELOW it, so no clipping. */}
      <div
        className={cn(
          "relative h-24 w-full md:h-32",
          group.cover_url ? "bg-cover bg-center" : "gradient-motion",
        )}
        style={group.cover_url ? { backgroundImage: `url(${group.cover_url})` } : undefined}
      >
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-b from-transparent to-background" />
      </div>

      {/* Title block — relative + z-10 so its own stacking context paints
          cleanly above the hero gradient regardless of sibling order. */}
      <div className="relative z-10 -mt-2 px-4 md:px-6">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 sm:gap-4">
          {/* Avatar tile — opaque background + ring; isolate forces its
              own stacking context so the ring + content always paint over
              the hero's bottom-fade. */}
          <div className="relative isolate -mt-6 flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-surface ring-4 ring-background shadow-lift sm:h-20 sm:w-20">
            {group.avatar_url ? (
              <img
                src={group.avatar_url}
                alt={group.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="font-display text-3xl font-semibold leading-none text-ink-soft"
              >
                {group.name.trim().charAt(0).toUpperCase() || (
                  <Icon className="h-8 w-8 text-ink-muted" />
                )}
              </span>
            )}
          </div>



          {/* Title column — gets the slack now that SparkBar moved into the tab bar */}
          <div className="min-w-0 pt-1">
            {group.parent && (
              <Link
                to="/g/$slug"
                params={{ slug: group.parent.slug }}
                className="mb-1 inline-flex items-center gap-1 text-[11px] font-medium text-ink-muted hover:text-ink"
              >
                <span aria-hidden>←</span> in {group.parent.name}
              </Link>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-soft">
                {group.kind}
              </span>
              {group.featured_at && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  <Star className="h-3 w-3" /> Featured
                </span>
              )}
              {group.is_official && (
                <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-medium text-ink-soft">
                  Official
                </span>
              )}
            </div>
            <h1 className="mt-1 text-balance font-display text-2xl leading-tight text-ink sm:text-3xl md:text-4xl">
              {group.name}
            </h1>
            {group.tagline && (
              <p className="mt-1 line-clamp-2 text-sm text-ink-muted md:text-base">
                {group.tagline}
              </p>
            )}
            {nextEvent && (
              <Link
                to="/g/$slug/e/$eventSlug"
                params={{ slug: group.slug, eventSlug: nextEvent.slug }}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/15"
              >
                <Calendar className="h-3.5 w-3.5" />
                {new Date(nextEvent.starts_at).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}{" "}
                · {nextEvent.title}
                <span aria-hidden>→</span>
              </Link>
            )}
            {group.member_count > 0 && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-muted">
                <Users className="h-3.5 w-3.5" />
                <span>{group.member_count} {group.member_count === 1 ? "member" : "members"}</span>
              </div>
            )}

          </div>

          {/* Right column: compact — Share + Join. Create lives in the tab bar. */}
          <div className="flex shrink-0 items-center gap-1.5 pt-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={onShare}
              aria-label="Share group"
            >
              <Share2 className="h-4 w-4" />
            </Button>
            <JoinGroupButton
              groupId={group.id}
              parent={group.parent ? { id: group.parent.id, name: group.parent.name } : null}
            />
          </div>
        </div>
      </div>
    </>
  );
}

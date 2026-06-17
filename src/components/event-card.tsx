import { Link } from "@tanstack/react-router";
import { Calendar, MapPin, Radio, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export type EventCardData = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  kind: string;
  format: "in_person" | "online" | "hybrid";
  cover_url: string | null;
  accent_color: string | null;
  starts_at: string;
  venue_name: string | null;
  venue_address: string | null;
  going_count: number;
  capacity: number | null;
  featured_at: string | null;
  promo_pass_months: number;
  group: { slug: string; name: string; avatar_url: string | null };
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function EventCard({ event, className }: { event: EventCardData; className?: string }) {
  return (
    <Link
      to="/g/$slug/e/$eventSlug"
      params={{ slug: event.group.slug, eventSlug: event.slug }}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift",
        className,
      )}
    >
      <div
        className={cn(
          "relative h-36 w-full",
          event.cover_url ? "bg-cover bg-center" : "gradient-motion",
        )}
        style={event.cover_url ? { backgroundImage: `url(${event.cover_url})` } : undefined}
      >
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-3">
          <div className="rounded-xl bg-background/90 px-2.5 py-1 text-center shadow-soft">
            <div className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">
              {new Date(event.starts_at).toLocaleDateString(undefined, { month: "short" })}
            </div>
            <div className="font-display text-lg leading-none text-ink">
              {new Date(event.starts_at).getDate()}
            </div>
          </div>
          {event.featured_at && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
              <Star className="h-3 w-3" /> Featured
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
          {event.format === "online" ? (
            <Radio className="h-3 w-3" />
          ) : (
            <MapPin className="h-3 w-3" />
          )}
          <span className="truncate">
            {event.format === "online"
              ? "Online"
              : event.venue_name ?? event.venue_address ?? "TBA"}
          </span>
        </div>
        <h3 className="font-display text-base text-ink line-clamp-2">{event.title}</h3>
        {event.tagline && <p className="text-xs text-ink-muted line-clamp-2">{event.tagline}</p>}
        <div className="mt-auto flex items-center justify-between pt-2 text-[11px] text-ink-muted">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" /> {formatDate(event.starts_at)} · {formatTime(event.starts_at)}
          </span>
          <span>
            {event.going_count} going{event.capacity ? ` / ${event.capacity}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-1.5 pt-1 text-[11px] text-ink-muted">
          <span>by</span>
          <span className="font-medium text-ink-soft">{event.group.name}</span>
          {event.promo_pass_months > 0 && (
            <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              +{event.promo_pass_months}mo Plus
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

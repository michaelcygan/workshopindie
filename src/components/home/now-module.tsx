import { Link } from "@tanstack/react-router";
import { Calendar, ChevronRight, MessageSquare, Radio } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { HomeEvent, HomeLounge, HomeTodaySummary, MemberHomePayload } from "@/lib/home-types";

function timeUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const hours = Math.round(diff / 3_600_000);
  if (hours < 1) return "starting soon";
  if (hours < 24) return `in ${hours}h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "tomorrow" : `in ${days} days`;
}

function Row({
  icon: Icon,
  live,
  title,
  detail,
  action,
  to,
  params,
  trailing,
}: {
  icon: typeof Radio;
  live?: boolean;
  title: string;
  detail?: string | null;
  action: string;
  to: string;
  params?: Record<string, string>;
  trailing?: React.ReactNode;
}) {
  return (
    <Link
      to={to as never}
      params={(params ?? {}) as never}
      aria-label={`${title} — ${action}`}
      className="group flex min-h-[56px] items-center gap-3 px-3 py-2.5 transition hover:bg-muted/60 md:min-h-[64px] md:flex-col md:items-start md:gap-1.5 md:px-4 md:py-4"
    >
      <span className="relative grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border text-ink-muted">
        <Icon className="h-3.5 w-3.5" />
        {live && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-surface" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-[15px] leading-snug text-ink group-hover:underline">
          {title}
        </div>
        {detail && <div className="truncate text-xs text-ink-soft">{detail}</div>}
      </div>
      {trailing}
      <span className="shrink-0 text-[11px] text-ink-muted group-hover:text-ink md:inline-flex md:items-center md:gap-1">
        <span className="hidden md:inline">{action}</span>
        <ChevronRight className="h-4 w-4 md:h-3 md:w-3" />
      </span>
    </Link>
  );
}

/**
 * One compact module standing in for the old three tall "Now" cards.
 * Same data, same routes — an empty state simply no longer gets the visual
 * weight of real activity.
 */
export function NowModule({
  today,
  lounges,
  fallbackGroup,
  nextEvent,
}: {
  today: HomeTodaySummary[];
  lounges: HomeLounge[];
  fallbackGroup: MemberHomePayload["loungeFallbackGroup"];
  nextEvent: HomeEvent | null;
}) {
  const topToday = today[0];
  const topLounge = lounges[0];

  return (
    <div className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-surface md:grid md:grid-cols-3 md:divide-x md:divide-y-0">
      {topToday ? (
        <Row
          icon={MessageSquare}
          title={topToday.groupName}
          detail={
            topToday.latestBody
              ? `${topToday.latestAuthor ? `${topToday.latestAuthor.display_name || topToday.latestAuthor.username}: ` : ""}${topToday.latestBody}`
              : `${topToday.postCount} in Today`
          }
          action="Open Today"
          to="/g/$slug"
          params={{ slug: topToday.groupSlug }}
        />
      ) : (
        <Row
          icon={MessageSquare}
          title="Boards are quiet"
          detail="Be the first voice today."
          action="Find a Group"
          to="/groups"
        />
      )}

      {topLounge ? (
        <Row
          icon={Radio}
          live
          title={topLounge.title}
          detail={`${topLounge.liveCount} live in ${topLounge.groupName}`}
          action="Join"
          to="/g/$slug"
          params={{ slug: topLounge.groupSlug }}
          trailing={
            topLounge.avatars.length ? (
              <span className="flex -space-x-2">
                {topLounge.avatars.slice(0, 3).map((a) => (
                  <Avatar key={a} className="h-5 w-5 border border-surface">
                    <AvatarImage src={a} alt="" />
                    <AvatarFallback className="text-[8px]">·</AvatarFallback>
                  </Avatar>
                ))}
              </span>
            ) : null
          }
        />
      ) : fallbackGroup ? (
        <Row
          icon={Radio}
          title="No one live yet"
          detail={`Start the audio layer in ${fallbackGroup.name}`}
          action="Open the Group"
          to="/g/$slug"
          params={{ slug: fallbackGroup.slug }}
        />
      ) : (
        <Row
          icon={Radio}
          title="No one live yet"
          detail="Join a Group and see who shows up."
          action="Find a Group"
          to="/groups"
        />
      )}

      {nextEvent ? (
        <Row
          icon={Calendar}
          title={nextEvent.title}
          detail={`${nextEvent.rsvped ? "You're going · " : ""}${timeUntil(nextEvent.startsAt)}${
            nextEvent.venueName
              ? ` · ${nextEvent.venueName}`
              : nextEvent.cityName
                ? ` · ${nextEvent.cityName}`
                : ""
          }`}
          action="Open event"
          to="/g/$slug/e/$eventSlug"
          params={{ slug: nextEvent.groupSlug, eventSlug: nextEvent.slug }}
        />
      ) : (
        <Row
          icon={Calendar}
          title="Nothing scheduled"
          detail="No events on your calendar yet."
          action="Browse Events"
          to="/events"
        />
      )}
    </div>
  );
}

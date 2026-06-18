import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { CalendarHeart, CalendarPlus, ArrowRight, Calendar } from "lucide-react";
import { listFeaturedEvents } from "@/lib/group-events.functions";
import { useUserRoles } from "@/hooks/use-user-role";
import { LiveDot } from "@/components/live-dot";

type EventLite = {
  id: string;
  slug: string;
  title: string;
  starts_at: string;
  cover_url: string | null;
  going_count: number;
  group?: { slug: string; name: string } | null;
};

/**
 * Compact, sidebar-friendly events card. Always renders something —
 * empty state shows the RSVP / Workshop Pass promise as a slim panel,
 * populated state shows a stacked list of up to 4 upcoming events.
 */
export function FeaturedEventsCompact({ className }: { className?: string }) {
  const fetchFn = useServerFn(listFeaturedEvents);
  const { isAdmin } = useUserRoles();
  const { data } = useQuery({
    queryKey: ["events", "featured"],
    queryFn: () => fetchFn(),
    staleTime: 60_000,
  });
  const events = (data ?? []) as unknown as EventLite[];
  const upcoming = events.slice(0, 6);

  return (
    <section className={className}>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <div className="flex items-center gap-2">
          <LiveDot live />
          <h2 className="font-display text-lg text-ink">Featured events</h2>
        </div>
        <span className="text-[11px] text-ink-muted">RSVP = free Pass</span>
      </div>

      {upcoming.length === 0 ? (
        <div className="flex items-start gap-3 rounded-2xl border border-dashed border-border bg-surface p-3.5">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-ink-soft">
            <CalendarHeart className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-[15px] leading-snug text-ink">
              Live events are coming.
            </h3>
            <p className="mt-1 text-xs text-ink-muted">
              Workshops, open mics, listening parties — RSVP unlocks a free Workshop Pass.
            </p>
            {isAdmin ? (
              <Link
                to="/admin/events"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <CalendarPlus className="h-3.5 w-3.5" /> Post the first event
              </Link>
            ) : null}
          </div>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {upcoming.map((ev) => {
            const starts = new Date(ev.starts_at);
            const groupSlug = ev.group?.slug ?? "";
            return (
              <li key={ev.id}>
                <Link
                  to="/g/$slug/e/$eventSlug"
                  params={{ slug: groupSlug, eventSlug: ev.slug }}
                  className="group flex items-center gap-3 rounded-2xl border border-transparent bg-surface p-2.5 transition hover:border-border hover:shadow-soft"
                >
                  <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl border border-border bg-background text-center">
                    <span className="text-[9px] font-medium uppercase text-ink-muted leading-none">
                      {starts.toLocaleDateString(undefined, { month: "short" })}
                    </span>
                    <span className="font-display text-sm leading-none text-ink">
                      {starts.getDate()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-ink">{ev.title}</div>
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-muted">
                      <Calendar className="h-3 w-3" />
                      {starts.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      {ev.group?.name && <span className="truncate"> · {ev.group.name}</span>}
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-muted opacity-0 transition group-hover:opacity-100" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

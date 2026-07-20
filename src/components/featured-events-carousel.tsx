import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { CalendarPlus, CalendarHeart } from "lucide-react";
import { listFeaturedEvents } from "@/lib/group-events.functions";
import { EventCard, type EventCardData } from "@/components/event-card";
import { Button } from "@/components/ui/button";
import { useUserRoles } from "@/hooks/use-user-role";

export function FeaturedEventsCarousel({
  className,
  hideWhenEmpty = false,
}: {
  className?: string;
  /** When true, render nothing if there are no featured events (no empty hero). */
  hideWhenEmpty?: boolean;
}) {
  const fetchFn = useServerFn(listFeaturedEvents);
  const { isAdmin } = useUserRoles();
  const { data } = useQuery({
    queryKey: ["events", "featured"],
    queryFn: () => fetchFn(),
    staleTime: 60_000,
  });
  const events = (data ?? []) as unknown as EventCardData[];
  if (hideWhenEmpty && events.length === 0) return null;

  return (
    <section className={className}>
      <div className="mb-6 flex items-end justify-between gap-3 px-1">
        <div>
          <h2 className="font-display text-3xl text-ink md:text-4xl">Events</h2>
          <p className="mt-1 text-sm text-ink-muted">What's happening across the network.</p>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-surface p-10 text-center">
          <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted text-ink-soft">
            <CalendarHeart className="h-6 w-6" />
          </div>
          <h3 className="font-display text-2xl text-ink">Live events are coming.</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
            Workshops, open mics, listening parties.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {isAdmin ? (
              <Link to="/admin/events">
                <Button className="rounded-full gap-2">
                  <CalendarPlus className="h-4 w-4" /> Post the first event
                </Button>
              </Link>
            ) : (
              <Link to="/groups">
                <Button variant="outline" className="rounded-full">Browse groups</Button>
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0 [scrollbar-width:thin]">
          {events.map((ev) => (
            <div key={ev.id} className="w-72 shrink-0">
              <EventCard event={ev} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

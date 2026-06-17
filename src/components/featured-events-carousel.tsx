import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { CalendarPlus } from "lucide-react";
import { listFeaturedEvents } from "@/lib/group-events.functions";
import { EventCard, type EventCardData } from "@/components/event-card";
import { useUserRoles } from "@/hooks/use-user-role";

export function FeaturedEventsCarousel({ className }: { className?: string }) {
  const fetchFn = useServerFn(listFeaturedEvents);
  const { isAdmin } = useUserRoles();
  const { data } = useQuery({
    queryKey: ["events", "featured"],
    queryFn: () => fetchFn(),
    staleTime: 60_000,
  });
  const events = (data ?? []) as unknown as EventCardData[];
  if (events.length === 0 && !isAdmin) return null;
  return (
    <section className={className}>
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h2 className="font-display text-xl text-ink md:text-2xl">Featured events</h2>
        <span className="text-xs text-ink-muted">RSVP unlocks free Workshop Pass</span>
      </div>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0 [scrollbar-width:thin]">
        {events.map((ev) => (
          <div key={ev.id} className="w-72 shrink-0">
            <EventCard event={ev} />
          </div>
        ))}
        {events.length === 0 && isAdmin && (
          <Link
            to="/admin/events"
            className="flex w-72 shrink-0 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border bg-surface p-8 text-center text-ink-soft transition hover:border-primary hover:text-primary"
          >
            <CalendarPlus className="h-6 w-6" />
            <div className="font-display text-base">Post the first Workshop event</div>
            <div className="text-xs text-ink-muted">Featured events surface here.</div>
          </Link>
        )}
      </div>
    </section>
  );
}

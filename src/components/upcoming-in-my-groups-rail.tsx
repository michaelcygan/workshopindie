import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listUpcomingForMyGroups } from "@/lib/group-events.functions";
import { EventCard, type EventCardData } from "@/components/event-card";
import { useAuth } from "@/hooks/use-auth";

export function UpcomingInMyGroupsRail({ className }: { className?: string }) {
  const { user } = useAuth();
  const fetchFn = useServerFn(listUpcomingForMyGroups);
  const { data } = useQuery({
    queryKey: ["events", "upcoming-my-groups", user?.id ?? null],
    enabled: !!user,
    queryFn: () => fetchFn(),
    staleTime: 60_000,
  });
  if (!user || !data || data.length === 0) return null;
  return (
    <section className={className}>
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h2 className="font-display text-xl text-ink md:text-2xl">Upcoming in your groups</h2>
        <span className="text-xs text-ink-muted">RSVP to lock your spot</span>
      </div>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0 [scrollbar-width:thin]">
        {(data as unknown as EventCardData[]).map((ev) => (
          <div key={ev.id} className="w-72 shrink-0">
            <EventCard event={ev} />
          </div>
        ))}
      </div>
    </section>
  );
}

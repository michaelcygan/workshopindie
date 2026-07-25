import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock } from "lucide-react";
import { listUpcomingForMyGroups } from "@/lib/group-events.functions";
import { EventCard, type EventCardData } from "@/components/event-card";
import { HomeSectionHeader } from "@/components/home-section";
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
      <HomeSectionHeader
        eyebrow={<><CalendarClock className="h-3.5 w-3.5" /> Your groups</>}
        title="Upcoming near you"
        kicker="RSVP to lock your spot before it fills up."
      />
      <div className="mt-8 -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0 [scrollbar-width:thin]">
        {(data as unknown as EventCardData[]).map((ev) => (
          <div key={ev.id} className="w-80 shrink-0">
            <EventCard event={ev} />
          </div>
        ))}
      </div>
    </section>
  );
}

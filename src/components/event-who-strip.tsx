import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProfilePeek } from "@/components/profile-peek";
import { listCheckedInAttendees } from "@/lib/event-companion.functions";

type Props = {
  eventId: string;
  /** "live" or "post" — only changes the label. */
  phase: "live" | "post";
};

/**
 * Sturdy strip of checked-in attendees. Returns null if no one has checked in
 * yet, so the surface degrades cleanly. Polls every 20s during live, longer
 * after.
 */
export function EventWhoStrip({ eventId, phase }: Props) {
  const listFn = useServerFn(listCheckedInAttendees);
  const { data } = useQuery({
    queryKey: ["event-checked-in", eventId],
    queryFn: () => listFn({ data: { event_id: eventId } }),
    refetchInterval: phase === "live" ? 20_000 : 60_000,
    staleTime: 10_000,
  });

  const people = data ?? [];
  if (people.length === 0) return null;

  const label = phase === "live" ? "Who's here" : "Who was here";

  return (
    <section className="rounded-3xl border border-border bg-surface p-5 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg text-ink">{label}</h3>
        <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
          <Users className="h-3.5 w-3.5" /> {people.length} checked in
        </span>
      </div>
      <div className="flex flex-wrap gap-3">
        {people.slice(0, 36).map((p) => {
          const name = p.display_name ?? p.username ?? "Someone";
          return (
            <ProfilePeek key={p.user_id} userId={p.user_id}>
              <button type="button" className="flex flex-col items-center gap-1">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={p.avatar_url ?? undefined} />
                  <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <span className="max-w-[60px] truncate text-[10px] text-ink-muted">{name}</span>
              </button>
            </ProfilePeek>
          );
        })}
        {people.length > 36 && (
          <div className="flex h-10 items-center justify-center rounded-full bg-muted px-3 text-xs text-ink-muted">
            +{people.length - 36}
          </div>
        )}
      </div>
    </section>
  );
}

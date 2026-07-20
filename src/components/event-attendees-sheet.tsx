import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProfilePeek } from "@/components/profile-peek";
import { listAttendees } from "@/lib/group-events.functions";
import { cn } from "@/lib/utils";

type Attendee = {
  user_id: string;
  status: "going" | "maybe" | "waitlist";
  profile: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

type Props = {
  eventId: string;
  goingCount: number;
  maybeCount?: number;
  waitlistCount?: number;
  capacity?: number | null;
  children: React.ReactNode;
};

const STATUS_ORDER: Array<Attendee["status"]> = ["going", "maybe", "waitlist"];

const STATUS_LABELS: Record<Attendee["status"], string> = {
  going: "Going",
  maybe: "Maybe",
  waitlist: "Waitlist",
};

export function EventAttendeesSheet({
  eventId,
  goingCount,
  maybeCount = 0,
  waitlistCount = 0,
  capacity,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const listFn = useServerFn(listAttendees);

  const { data: attendees, isLoading } = useQuery({
    queryKey: ["event-attendees", eventId],
    queryFn: () => listFn({ data: { event_id: eventId } }),
    enabled: open,
    staleTime: 30_000,
  });

  const groups = (() => {
    const rows = (attendees ?? []) as Attendee[];
    return STATUS_ORDER.map((status) => ({
      status,
      label: STATUS_LABELS[status],
      people: rows.filter((a) => a.status === status),
      count:
        status === "going"
          ? goingCount
          : status === "maybe"
            ? maybeCount
            : waitlistCount,
    })).filter((g) => g.count > 0 || g.people.length > 0);
  })();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] overflow-y-auto rounded-t-3xl bg-surface px-4 pb-8"
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="font-display text-xl">Attendees</SheetTitle>
        </SheetHeader>

        <div className="mb-4 flex flex-wrap gap-2 text-sm text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {goingCount}
            {capacity ? ` / ${capacity}` : ""} going
          </span>
          {maybeCount > 0 && <span>{maybeCount} maybe</span>}
          {waitlistCount > 0 && <span>{waitlistCount} waitlist</span>}
        </div>

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
                <div className="h-4 w-32 rounded bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && groups.length === 0 && (
          <p className="text-sm text-ink-muted">No one has RSVP'd yet.</p>
        )}

        {!isLoading &&
          groups.map((group) => (
            <div key={group.status} className="mb-5">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
                <span>{group.label}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">
                  {group.count}
                </span>
              </div>
              <ul className="space-y-1">
                {group.people.map((a) => {
                  const p = a.profile;
                  if (!p) return null;
                  const name = p.display_name ?? p.username ?? "Someone";
                  return (
                    <li key={a.user_id}>
                      <ProfilePeek userId={a.user_id}>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors",
                            "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          )}
                        >
                          <Avatar className="h-9 w-9 border border-border">
                            <AvatarImage src={p.avatar_url ?? undefined} />
                            <AvatarFallback className="text-xs">
                              {name.slice(0, 1)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium text-ink">
                            {name}
                          </span>
                        </button>
                      </ProfilePeek>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
      </SheetContent>
    </Sheet>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { ProfilePeek } from "@/components/profile-peek";
import {
  checkInToEvent,
  listEventRoster,
  undoCheckIn,
} from "@/lib/events/participation.functions";
import type { EventAccess } from "@/lib/events/access.server";

type Props = {
  eventId: string;
  access: EventAccess | null;
  onChanged: () => void;
};

/**
 * Who's here — the roster of people who said "I'm in the room".
 * Check-in is always an explicit tap, never automatic.
 */
export function EventWhosHere({ eventId, access, onChanged }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const rosterFn = useServerFn(listEventRoster);
  const checkInFn = useServerFn(checkInToEvent);
  const undoFn = useServerFn(undoCheckIn);

  const { data: roster, isLoading } = useQuery({
    queryKey: ["event-roster", eventId, user?.id ?? null],
    enabled: !!user && !!access?.canSeeRoster,
    queryFn: () => rosterFn({ data: { event_id: eventId } }),
    staleTime: 20_000,
    refetchInterval: 60_000,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["event-roster", eventId] });
    onChanged();
  };

  const checkIn = useMutation({
    mutationFn: () => checkInFn({ data: { event_id: eventId } }),
    onSuccess: (r) => {
      if (r.checkedIn) toast.success("You're here.");
      else if (r.reason === "not_attending") toast.error("RSVP first.");
      else toast.error("Check-in isn't open right now.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const undo = useMutation({
    mutationFn: () => undoFn({ data: { event_id: eventId } }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-background p-8 text-center text-sm text-ink-muted">
        Sign in and RSVP to see who's here.
      </p>
    );
  }

  if (!access?.canSeeRoster) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-background p-8 text-center text-sm text-ink-muted">
        RSVP to see who's here.
      </p>
    );
  }

  const people = roster ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
        <div>
          <p className="text-sm font-medium text-ink">
            {access.isCheckedIn ? "You're checked in" : "Are you in the room?"}
          </p>
          <p className="text-xs text-ink-muted">
            {people.length === 0
              ? "No one has checked in yet."
              : `${people.length} ${people.length === 1 ? "person" : "people"} here.`}
          </p>
        </div>
        {access.isCheckedIn ? (
          <Button size="sm" variant="outline" className="rounded-md" onClick={() => undo.mutate()} disabled={undo.isPending}>
            Undo
          </Button>
        ) : (
          <Button
            size="sm"
            className="rounded-md gap-1.5"
            onClick={() => checkIn.mutate()}
            disabled={checkIn.isPending || !access.canCheckIn}
            title={access.canCheckIn ? undefined : "Check-in opens when the Event starts"}
          >
            {checkIn.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
            I'm here
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-ink-muted">Loading…</div>
      ) : people.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-background p-8 text-center text-sm text-ink-muted">
          Be the first to check in.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {people.map((p) => {
            const name = p.display_name ?? p.username ?? "Someone";
            return (
              <li key={p.user_id}>
                <ProfilePeek userId={p.user_id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left transition-colors hover:border-ink/30"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={p.avatar_url ?? undefined} />
                      <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{name}</span>
                      {p.username && <span className="block truncate text-xs text-ink-muted">@{p.username}</span>}
                    </span>
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-ink-muted" />
                  </button>
                </ProfilePeek>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

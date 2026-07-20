import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { rsvp } from "@/lib/group-events.functions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EventRsvpAuthSheet } from "@/components/event-rsvp-auth-sheet";

export type MyRsvp = {
  status: "going" | "maybe" | "waitlist" | "declined" | "canceled";
  plus_ones: number;
  note: string | null;
} | null;

export function EventRsvpBlock({
  eventId,
  groupSlug,
  eventSlug,
  myRsvp,
  capacity,
  goingCount,
  waitlistEnabled,
  startsAt,
  timezone,
  isRecurring,
}: {
  eventId: string;
  groupSlug: string;
  eventSlug: string;
  myRsvp: MyRsvp;
  capacity: number | null;
  goingCount: number;
  waitlistEnabled: boolean;
  startsAt?: string | null;
  timezone?: string | null;
  isRecurring?: boolean;
}) {
  const { user } = useAuth();
  const rsvpFn = useServerFn(rsvp);
  const qc = useQueryClient();
  const [authSheetOpen, setAuthSheetOpen] = useState(false);
  const [pending, setPending] = useState<"going" | "declined" | null>(null);

  const isFull = capacity !== null && goingCount >= capacity;
  const status = myRsvp?.status ?? null;
  const redirectTo = `/g/${groupSlug}/e/${eventSlug}`;
  const going = status === "going" || status === "waitlist";
  const declined = status === "declined";

  // Format the specific occurrence date so the RSVP block never feels ambiguous
  // on a recurring series ("Am I signing up for one date or all of them?").
  const dateLabel = (() => {
    if (!startsAt) return null;
    try {
      const d = new Date(startsAt);
      if (Number.isNaN(d.getTime())) return null;
      const fmt = new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: timezone || undefined,
      });
      return fmt.format(d);
    } catch { return null; }
  })();

  // Resume pending RSVP after returning signed-in.
  useEffect(() => { void pending; }, [pending]);

  async function commit(s: "going" | "declined") {
    if (!user) {
      setPending(s);
      setAuthSheetOpen(true);
      return;
    }
    try {
      await rsvpFn({ data: { event_id: eventId, status: s, plus_ones: 0, note: null } });
      qc.invalidateQueries({ queryKey: ["event-rsvp", eventId] });
      qc.invalidateQueries({ queryKey: ["event-attendees", eventId] });
      qc.invalidateQueries({ queryKey: ["event", eventId] });
      toast.success(
        s === "going"
          ? isFull && waitlistEnabled
            ? dateLabel ? `You're on the waitlist for ${dateLabel}.` : "You're on the waitlist."
            : dateLabel ? `You're in for ${dateLabel}.` : "You're in. See you there."
          : dateLabel ? `Marked can't make ${dateLabel}.` : "Marked can't make it.",
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="rounded-3xl border border-border bg-surface p-5 shadow-soft">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="font-display text-lg text-ink">RSVP</h3>
        {status === "waitlist" && (
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700">On waitlist</span>
        )}
        {status === "going" && (
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            {dateLabel ? `You're going · ${dateLabel}` : "You're going"}
          </span>
        )}
      </div>
      {dateLabel && (
        <p className="mb-3 text-xs text-ink-muted">
          {isRecurring
            ? <>This RSVP is just for <span className="font-medium text-ink">{dateLabel}</span>. Each date in the series has its own page.</>
            : <>For <span className="font-medium text-ink">{dateLabel}</span>.</>}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          onClick={() => commit("going")}
          variant={going ? "default" : "outline"}
          className={cn("rounded-2xl py-5", going && "shadow-lift")}
        >
          <Check className="mr-1.5 h-4 w-4" />
          {dateLabel ? <>I'm in for <span className="ml-1 hidden sm:inline">{dateLabel}</span><span className="ml-1 sm:hidden">this date</span></> : "I'm in"}
        </Button>
        <Button
          type="button"
          onClick={() => commit("declined")}
          variant={declined ? "default" : "outline"}
          className={cn("rounded-2xl py-5", declined && "shadow-lift")}
        >
          <X className="mr-1.5 h-4 w-4" /> Can't make it
        </Button>
      </div>
      <p className="mt-3 text-[11px] text-ink-muted">
        RSVPs are visible to other group members.
      </p>

      <EventRsvpAuthSheet
        open={authSheetOpen}
        onOpenChange={setAuthSheetOpen}
        eventId={eventId}
        status={pending ?? "going"}
        redirectTo={redirectTo}
      />
    </div>
  );
}

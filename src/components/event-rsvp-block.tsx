import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Check, X, Minus, Plus, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { rsvp } from "@/lib/group-events.functions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EventRsvpAuthSheet } from "@/components/event-rsvp-auth-sheet";

export type MyRsvp = {
  status: "going" | "maybe" | "waitlist" | "declined" | "canceled";
  plus_ones: number;
  note: string | null;
  promo_pass_granted_at: string | null;
} | null;

export function EventRsvpBlock({
  eventId,
  groupSlug,
  eventSlug,
  myRsvp,
  capacity,
  goingCount,
  waitlistEnabled,
}: {
  eventId: string;
  groupSlug: string;
  eventSlug: string;
  myRsvp: MyRsvp;
  capacity: number | null;
  goingCount: number;
  waitlistEnabled: boolean;
}) {
  const { user } = useAuth();
  const rsvpFn = useServerFn(rsvp);
  const qc = useQueryClient();
  const [authSheetOpen, setAuthSheetOpen] = useState(false);
  const [pending, setPending] = useState<"going" | "maybe" | "declined" | null>(null);
  const [plusOnes, setPlusOnes] = useState(myRsvp?.plus_ones ?? 0);
  const [note, setNote] = useState(myRsvp?.note ?? "");

  useEffect(() => {
    setPlusOnes(myRsvp?.plus_ones ?? 0);
    setNote(myRsvp?.note ?? "");
  }, [myRsvp]);

  const isFull = capacity !== null && goingCount >= capacity;
  const status = myRsvp?.status ?? null;
  const redirectTo = `/g/${groupSlug}/e/${eventSlug}`;

  async function commit(s: "going" | "maybe" | "declined") {
    if (!user) {
      setPending(s);
      setAuthSheetOpen(true);
      return;
    }
    try {
      await rsvpFn({ data: { event_id: eventId, status: s, plus_ones: plusOnes, note: note || null } });
      qc.invalidateQueries({ queryKey: ["event-rsvp", eventId] });
      qc.invalidateQueries({ queryKey: ["event-attendees", eventId] });
      qc.invalidateQueries({ queryKey: ["event", eventId] });
      toast.success(
        s === "going"
          ? isFull && waitlistEnabled
            ? "You're on the waitlist."
            : "You're in. See you there."
          : s === "maybe"
            ? "Marked maybe."
            : "RSVP updated.",
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="rounded-3xl border border-border bg-surface p-5 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg text-ink">Your RSVP</h3>
        {status === "waitlist" && (
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700">
            On waitlist
          </span>
        )}
        {status === "going" && (
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            You're going
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <RsvpBtn label="Going" icon={Check} active={status === "going" || status === "waitlist"} onClick={() => commit("going")} />
        <RsvpBtn label="Maybe" icon={HelpCircle} active={status === "maybe"} onClick={() => commit("maybe")} />
        <RsvpBtn label="Can't" icon={X} active={status === "declined"} onClick={() => commit("declined")} />
      </div>
      {(status === "going" || status === "waitlist") && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-soft">Plus ones</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const v = Math.max(0, plusOnes - 1);
                  setPlusOnes(v);
                  if (user) rsvpFn({ data: { event_id: eventId, status: "going", plus_ones: v, note: note || null } }).then(() => qc.invalidateQueries({ queryKey: ["event-rsvp", eventId] }));
                }}
                className="rounded-full border border-border p-1 hover:bg-muted"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="w-4 text-center font-medium text-ink">{plusOnes}</span>
              <button
                onClick={() => {
                  const v = Math.min(2, plusOnes + 1);
                  setPlusOnes(v);
                  if (user) rsvpFn({ data: { event_id: eventId, status: "going", plus_ones: v, note: note || null } }).then(() => qc.invalidateQueries({ queryKey: ["event-rsvp", eventId] }));
                }}
                className="rounded-full border border-border p-1 hover:bg-muted"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>
          <Textarea
            placeholder="Note for the host (optional, ≤280 chars)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              if (user) rsvpFn({ data: { event_id: eventId, status: "going", plus_ones: plusOnes, note: note || null } });
            }}
            maxLength={280}
            className="resize-none text-sm"
            rows={2}
          />
        </div>
      )}
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

function RsvpBtn({ label, icon: Icon, active, onClick }: { label: string; icon: typeof Check; active: boolean; onClick: () => void }) {
  return (
    <Button
      type="button"
      onClick={onClick}
      variant={active ? "default" : "outline"}
      className={cn("rounded-2xl py-5", active && "shadow-lift")}
    >
      <Icon className="mr-1.5 h-4 w-4" /> {label}
    </Button>
  );
}

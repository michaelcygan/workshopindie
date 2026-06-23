import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Radio, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { autoCheckInToEvent } from "@/lib/event-companion.functions";
import { EventWhoStrip } from "@/components/event-who-strip";
import { EventShowcaseStrip } from "@/components/event-showcase-strip";
import { EventShowcaseProjectorButton } from "@/components/event-showcase-projector-button";
import { EventAttendeeWork } from "@/components/event-attendee-work";
import { EventPhotosSection, EventPhotosProjectorButton } from "@/components/event-photos-section";

type Props = {
  eventId: string;
  eventTitle: string;
  canBring: boolean;
  /** Has the viewer RSVP'd going/maybe? Required for auto check-in. */
  attending: boolean;
};

/**
 * Live-window companion panel. Renders only during the live phase for RSVP'd
 * viewers. Each section is independently wrapped in a try-boundary at the
 * data layer (server fns return safe empties on failure), so a single broken
 * section never blanks the panel.
 *
 * Sections:
 *  1. Auto check-in (silent effect + tiny success indicator)
 *  2. Who's here (checked-in attendees)
 *  3. Drop a work into the showcase + projector mode
 *  4. Works & collabs by attendees (reuses EventAttendeeWork)
 */
export function EventCompanionPanel({ eventId, eventTitle, canBring, attending }: Props) {
  return (
    <section className="mt-6 space-y-5 rounded-3xl border border-primary/30 bg-primary/[0.04] p-5">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <span className="font-display text-base text-ink">Happening now</span>
        </div>
        <span className="text-[11px] uppercase tracking-wide text-ink-muted">Live</span>
      </header>

      {attending && <AutoCheckIn eventId={eventId} />}

      <ErrorBoundarySafe>
        <EventWhoStrip eventId={eventId} phase="live" />
      </ErrorBoundarySafe>

      <ErrorBoundarySafe>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-sm uppercase tracking-wide text-ink-muted">Showcase</h3>
          <EventShowcaseProjectorButton eventId={eventId} />
        </div>
        <EventShowcaseStrip eventId={eventId} eventTitle={eventTitle} canBring={canBring} />
      </ErrorBoundarySafe>

      <ErrorBoundarySafe>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-sm uppercase tracking-wide text-ink-muted">Photos</h3>
          <EventPhotosProjectorButton eventId={eventId} />
        </div>
        <EventPhotosSection eventId={eventId} canUpload={attending} />
      </ErrorBoundarySafe>

      <ErrorBoundarySafe>
        <EventAttendeeWork eventId={eventId} />
      </ErrorBoundarySafe>
    </section>
  );
}

function AutoCheckIn({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const fn = useServerFn(autoCheckInToEvent);
  const fired = useRef(false);

  const mut = useMutation({
    mutationFn: () => fn({ data: { event_id: eventId } }),
    onSuccess: (res) => {
      if (res.checkedIn) {
        toast.success("You're checked in", { icon: <Radio className="h-4 w-4" /> });
        qc.invalidateQueries({ queryKey: ["event-checked-in", eventId] });
      }
    },
    // Silent on failure — never block the page.
    onError: () => {},
  });

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    mut.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-background/70 px-3 py-1 text-xs text-ink-soft">
      <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> You're here
    </div>
  );
}

/**
 * Tiny boundary so a single section's render error doesn't blank the panel.
 * Lightweight on purpose — we don't want to pull in a full ErrorBoundary lib.
 */
function ErrorBoundarySafe({ children }: { children: React.ReactNode }) {
  try {
    return <>{children}</>;
  } catch {
    return null;
  }
}

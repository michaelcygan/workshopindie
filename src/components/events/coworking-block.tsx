import { Armchair, BatteryCharging, Clock, Coffee, Users2 } from "lucide-react";
import {
  COWORKING_ATTRITION_NOTE,
  COWORKING_BRING_NOTE,
  COWORKING_FIRST_COME_NOTE,
  COWORKING_HOSTLESS_NOTE,
  COWORKING_SESSION_NOTE,
  WRITING_BRING_NOTE,
  WRITING_SESSION_HEADING,
  WRITING_SESSION_NOTE,
  activityLabel,
  isWritingSession,
  daypartLabel,
  powerNote,
  wifiNote,
} from "@/lib/events/coworking";
import { coworkingVenueMeta, getWorkshopVenue } from "@/lib/events/workshop-venues";

/**
 * Everything a person needs to walk into a Co-working session cold: what it
 * is, how the seating works, what to bring, and how to find the group. This
 * block replaces the coordination a host would otherwise do in a group chat.
 */
export function CoworkingBlock({
  daypart,
  facilitation,
  dropInAllowed,
  allowedActivities,
  arrivalNote,
  minAge,
  capacity,
  overflow,
  workshopVenueKey,
  startsAt,
  endsAt,
  timezone,
}: {
  daypart: string | null;
  facilitation: string | null;
  dropInAllowed: boolean | null;
  allowedActivities: string[] | null;
  arrivalNote: string | null;
  minAge: number | null;
  capacity: number | null;
  overflow: number | null;
  workshopVenueKey: string | null;
  startsAt: string;
  endsAt: string | null;
  timezone: string | null;
}) {
  const venue = getWorkshopVenue(workshopVenueKey);
  const meta = coworkingVenueMeta(workshopVenueKey);
  const hostless = facilitation !== "hosted";
  const activities = (allowedActivities ?? []).filter(Boolean);
  const writing = isWritingSession(activities);
  const power = powerNote(meta?.power ?? null);
  const wifi = wifiNote(venue?.wifi ?? null);

  const window = (() => {
    try {
      const fmt = (iso: string) =>
        new Intl.DateTimeFormat(undefined, {
          hour: "numeric",
          minute: "2-digit",
          timeZone: timezone || undefined,
        }).format(new Date(iso));
      return endsAt ? `${fmt(startsAt)} – ${fmt(endsAt)}` : fmt(startsAt);
    } catch {
      return null;
    }
  })();

  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-cat-coworking px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-cat-coworking-ink">
          Co-working
        </span>
        {daypart && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-soft">
            {daypartLabel(daypart)}
          </span>
        )}
        {hostless && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-soft">
            No host
          </span>
        )}
        {minAge != null && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-soft">
            {minAge}+
          </span>
        )}
      </div>

      <h3 className="mt-3 font-display text-lg text-ink">
        {writing ? WRITING_SESSION_HEADING : "A quiet working session"}
      </h3>
      <p className="mt-1 text-sm text-ink-soft">
        {writing ? WRITING_SESSION_NOTE : COWORKING_SESSION_NOTE}
      </p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {window && (
          <Row icon={<Clock className="h-4 w-4" />} title="Working window">
            {window}
            {dropInAllowed === false
              ? " · Please arrive at the start."
              : " · Drop in and leave whenever you need to."}
          </Row>
        )}
        <Row icon={<Armchair className="h-4 w-4" />} title="Seating">
          {COWORKING_FIRST_COME_NOTE}
        </Row>
        <Row icon={<BatteryCharging className="h-4 w-4" />} title="Power and Wi-Fi">
          {[power, wifi].filter(Boolean).join(" ") || "Come charged — outlets aren't guaranteed."}
        </Row>
        <Row icon={<Coffee className="h-4 w-4" />} title="What to bring">
          {writing ? WRITING_BRING_NOTE : COWORKING_BRING_NOTE}
        </Row>
        {capacity != null && (
          <Row icon={<Users2 className="h-4 w-4" />} title="Group size">
            Kept to about {capacity} people.{" "}
            {overflow && overflow > 0 ? COWORKING_ATTRITION_NOTE : ""}
          </Row>
        )}
      </dl>

      {activities.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">Good for</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {activities.map((a) => (
              <span
                key={a}
                className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-ink-soft"
              >
                {activityLabel(a)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 rounded-lg border border-dashed border-border bg-background p-3 text-sm text-ink-soft">
        <p className="font-medium text-ink">Finding the group</p>
        <p className="mt-1">{arrivalNote?.trim() || (hostless ? COWORKING_HOSTLESS_NOTE : null)}</p>
        <p className="mt-1">
          Open <span className="font-medium text-ink">Who's here</span> to check in, and post your
          seat on the <span className="font-medium text-ink">Wall</span> so the next person can find
          you.
        </p>
      </div>
    </section>
  );
}

function Row({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 text-ink-muted">{icon}</span>
      <div>
        <dt className="text-[11px] uppercase tracking-wide text-ink-muted">{title}</dt>
        <dd className="text-sm text-ink-soft">{children}</dd>
      </div>
    </div>
  );
}

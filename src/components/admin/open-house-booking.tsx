import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarPlus, ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  adminBookApplicationForEvent,
  adminListApplicationBookings,
  adminListOpenHouseOccurrences,
  adminRemoveEventFeature,
} from "@/lib/events/event-features.functions";
import { applicationTypeLabel, type OpenHouseApplication } from "@/lib/open-house";

/**
 * Admin booking: turn an Open House application into a public "Featuring"
 * entry on one exact occurrence. Booking is per-night — a partner can be
 * booked for several occurrences, each with its own copy.
 */

function occurrenceLabel(o: {
  startsAt: string;
  timezone: string | null;
  venueName: string | null;
}): string {
  const d = new Date(o.startsAt);
  const when = d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(o.timezone ? { timeZone: o.timezone } : {}),
  });
  return o.venueName ? `${when} · ${o.venueName}` : when;
}

export function OpenHouseBookingPanel({ app }: { app: OpenHouseApplication }) {
  const qc = useQueryClient();
  const occurrencesFn = useServerFn(adminListOpenHouseOccurrences);
  const bookingsFn = useServerFn(adminListApplicationBookings);
  const bookFn = useServerFn(adminBookApplicationForEvent);
  const removeFn = useServerFn(adminRemoveEventFeature);

  const [open, setOpen] = useState(false);
  const [eventId, setEventId] = useState<string>("");
  const [displayName, setDisplayName] = useState(app.project_name || app.contact_name);
  const [roleLabel, setRoleLabel] = useState(applicationTypeLabel(app));
  const [about, setAbout] = useState("");
  const [venueConfirmed, setVenueConfirmed] = useState(false);
  const [makeHost, setMakeHost] = useState(false);

  const { data: occ } = useQuery({
    queryKey: ["admin", "open-house-occurrences"],
    queryFn: () => occurrencesFn(),
    enabled: open,
    staleTime: 60_000,
  });

  const { data: booked } = useQuery({
    queryKey: ["admin", "open-house-bookings", app.id],
    queryFn: () => bookingsFn({ data: { applicationId: app.id } }),
    staleTime: 30_000,
  });

  const bookings = booked?.bookings ?? [];
  const bookedEventIds = useMemo(
    () => new Set(bookings.map((b) => b.eventId)),
    [bookings],
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "open-house-bookings", app.id] });
    qc.invalidateQueries({ queryKey: ["admin", "open-house-occurrences"] });
    qc.invalidateQueries({ queryKey: ["admin", "open-house-applications"] });
  };

  const book = useMutation({
    mutationFn: () =>
      bookFn({
        data: {
          applicationId: app.id,
          eventId,
          displayName: displayName.trim(),
          roleLabel: roleLabel.trim(),
          about: about.trim(),
          venueConfirmed,
          makeHost,
        },
      }),
    onSuccess: () => {
      toast.success("Booked for that night");
      setOpen(false);
      setEventId("");
      setAbout("");
      setVenueConfirmed(false);
      setMakeHost(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Booking removed");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit =
    !!eventId &&
    displayName.trim().length > 0 &&
    roleLabel.trim().length > 0 &&
    about.trim().length > 0 &&
    venueConfirmed &&
    !book.isPending;

  return (
    <div className="rounded-2xl border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wider text-ink-muted">Event bookings</p>
        {!open && (
          <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={() => setOpen(true)}>
            <CalendarPlus className="h-3.5 w-3.5" /> Book for an Open House
          </Button>
        )}
      </div>

      {bookings.length === 0 ? (
        <p className="mt-2 text-xs text-ink-muted">Not booked for any night yet.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {bookings.map((b) => (
            <li
              key={b.id}
              className="flex items-start justify-between gap-2 rounded-xl bg-muted/40 p-2"
            >
              <div className="min-w-0">
                <p className="text-sm text-ink">
                  {b.startsAt ? new Date(b.startsAt).toLocaleString() : b.eventTitle}
                </p>
                <p className="text-xs text-ink-muted">
                  {b.displayName} · {b.roleLabel}
                </p>
                {b.groupSlug && b.eventSlug && (
                  <a
                    href={`/g/${b.groupSlug}/e/${b.eventSlug}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    View event <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 shrink-0 px-2 text-ink-muted"
                disabled={remove.isPending}
                onClick={() => remove.mutate(b.id)}
                aria-label="Remove booking"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <div className="space-y-1">
            <label className="text-xs text-ink-muted">Occurrence</label>
            <Select value={eventId} onValueChange={setEventId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a night" />
              </SelectTrigger>
              <SelectContent>
                {(occ?.occurrences ?? []).map((o) => (
                  <SelectItem key={o.id} value={o.id} disabled={bookedEventIds.has(o.id)}>
                    {occurrenceLabel(o)}
                    {o.featureCount ? ` · ${o.featureCount} featured` : ""}
                    {bookedEventIds.has(o.id) ? " · already booked" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {occ && occ.occurrences.length === 0 && (
              <p className="text-xs text-ink-muted">
                No upcoming Open House occurrences are scheduled.
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-ink-muted">Public name</label>
              <Input
                value={displayName}
                maxLength={160}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-ink-muted">Role</label>
              <Input
                value={roleLabel}
                maxLength={80}
                onChange={(e) => setRoleLabel(e.target.value)}
                placeholder="DJ, Food vendor, Host…"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-ink-muted">Public about (shown on the event)</label>
            <Textarea
              value={about}
              rows={3}
              maxLength={600}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="One or two lines the public sees. Don't paste the private proposal."
            />
            <p className="text-[11px] text-ink-muted">{about.trim().length}/600</p>
          </div>

          <label className="flex items-start gap-2 text-xs text-ink-soft">
            <Checkbox
              checked={venueConfirmed}
              onCheckedChange={(v) => setVenueConfirmed(v === true)}
            />
            <span>
              I've confirmed the venue permits this activity. A Workshop venue record does not
              itself authorize a performance or programmed event.
            </span>
          </label>

          <label className="flex items-start gap-2 text-xs text-ink-soft">
            <Checkbox checked={makeHost} onCheckedChange={(v) => setMakeHost(v === true)} />
            <span>
              This partner is hosting the night (removes the "no host" signal). Leave unchecked for
              performers, vendors, and speakers.
            </span>
          </label>

          <div className="flex gap-2">
            <Button size="sm" disabled={!canSubmit} onClick={() => book.mutate()}>
              {book.isPending ? "Booking…" : "Book"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarRange } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminListGroups, createEvent } from "@/lib/group-events-admin.functions";
import {
  COWORKING_DEFAULTS,
  DAYPART_WINDOWS,
  coworkingTitle,
  daypartLabel,
  type Daypart,
} from "@/lib/events/coworking";
import { listCoworkingVenues } from "@/lib/events/workshop-venues";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Row = { venueKey: string; daypart: Daypart; weekday: number; enabled: boolean };

/**
 * Builds a Morning / Afternoon / Evening rotation across reviewed Co-working
 * venues. Each occurrence is an ordinary Event row — no separate calendar, no
 * separate object — so everything downstream (RSVP, Who's here, Wall) already
 * works. Admin only: rotations commit real public sessions.
 */
export function CoworkingRotationBuilder({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const groupsFn = useServerFn(adminListGroups);
  const createFn = useServerFn(createEvent);
  const { data: groups } = useQuery({
    queryKey: ["admin-events-groups"],
    queryFn: () => groupsFn(),
    enabled: open,
  });

  const venues = useMemo(() => listCoworkingVenues(), []);
  const [groupId, setGroupId] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [weeks, setWeeks] = useState("4");
  const [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[]>(() =>
    venues.map((v, i) => ({
      venueKey: v.venue.key,
      daypart: v.meta.dayparts[0] ?? "afternoon",
      weekday: (i % 5) + 1,
      enabled: i < 3,
    })),
  );

  const active = rows.filter((r) => r.enabled);
  const total = active.length * Math.max(1, Number(weeks) || 0);

  function occurrenceStart(weekday: number, daypart: Daypart, weekIndex: number): Date {
    const base = new Date(`${startDate}T00:00:00`);
    const delta = (weekday - base.getDay() + 7) % 7;
    const d = new Date(base);
    d.setDate(base.getDate() + delta + weekIndex * 7);
    d.setHours(DAYPART_WINDOWS[daypart].startHour, 0, 0, 0);
    return d;
  }

  async function generate() {
    if (!groupId) {
      toast.error("Pick the group that owns these sessions.");
      return;
    }
    if (active.length === 0) {
      toast.error("Select at least one venue.");
      return;
    }
    setBusy(true);
    let made = 0;
    const failures: string[] = [];
    try {
      for (let w = 0; w < Math.max(1, Number(weeks) || 1); w++) {
        for (const row of active) {
          const entry = venues.find((v) => v.venue.key === row.venueKey);
          if (!entry) continue;
          const starts = occurrenceStart(row.weekday, row.daypart, w);
          const ends = new Date(starts);
          ends.setHours(ends.getHours() + DAYPART_WINDOWS[row.daypart].hours);
          try {
            await createFn({
              data: {
                group_id: groupId,
                title: coworkingTitle(entry.venue.venue_name, row.daypart),
                tagline: COWORKING_DEFAULTS.tagline,
                description: null,
                kind: "coworking",
                format: "in_person",
                starts_at: starts.toISOString(),
                ends_at: ends.toISOString(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
                venue_name: entry.venue.venue_name,
                venue_address: entry.venue.address,
                venue_lat: entry.venue.lat,
                venue_lng: entry.venue.lng,
                workshop_venue_key: entry.venue.key,
                capacity: entry.meta.capacity,
                overflow: entry.meta.overflow,
                waitlist_enabled: true,
                daypart: row.daypart,
                min_age: entry.meta.min_age,
                facilitation: "hostless",
                drop_in_allowed: true,
                allowed_activities: [...entry.meta.activities],
                status: publish ? ("scheduled" as const) : ("draft" as const),
              },
            });
            made += 1;
          } catch (e) {
            failures.push(`${entry.venue.venue_name}: ${(e as Error).message}`);
          }
        }
      }
      if (made > 0) {
        toast.success(
          `${made} Co-working session${made === 1 ? "" : "s"} ${publish ? "published" : "saved as drafts"}.`,
        );
      }
      if (failures.length > 0) toast.error(failures[0]!);
      if (made > 0) {
        setOpen(false);
        onCreated();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-full">
          <CalendarRange className="mr-1 h-4 w-4" /> Co-working rotation
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Build a Co-working rotation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Group</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger><SelectValue placeholder="Choose group" /></SelectTrigger>
              <SelectContent>
                {(groups ?? []).map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start from</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>Weeks</Label>
              <Input
                type="number"
                min={1}
                max={12}
                value={weeks}
                onChange={(e) => setWeeks(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Venues in the rotation</Label>
            {venues.map((v, i) => {
              const row = rows[i]!;
              return (
                <div
                  key={v.venue.key}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r, j) => (j === i ? { ...r, enabled: e.target.checked } : r)),
                      )
                    }
                  />
                  <span className="min-w-0 flex-1 truncate text-ink">{v.venue.venue_name}</span>
                  <select
                    value={row.weekday}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r, j) =>
                          j === i ? { ...r, weekday: Number(e.target.value) } : r,
                        ),
                      )
                    }
                    className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
                  >
                    {WEEKDAYS.map((d, idx) => (
                      <option key={d} value={idx}>{d}</option>
                    ))}
                  </select>
                  <select
                    value={row.daypart}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r, j) =>
                          j === i ? { ...r, daypart: e.target.value as Daypart } : r,
                        ),
                      )
                    }
                    className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
                  >
                    {v.meta.dayparts.map((d) => (
                      <option key={d} value={d}>{daypartLabel(d)}</option>
                    ))}
                  </select>
                </div>
              );
            })}
            <p className="text-[11px] text-ink-muted">
              Only venues reviewed for Co-working appear here. Each session uses that venue's
              reviewed group size, age policy and working window.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={publish}
              onChange={(e) => setPublish(e.target.checked)}
            />
            Publish immediately (otherwise saved as drafts to review)
          </label>

          <Button onClick={generate} disabled={busy} className="w-full rounded-full">
            {busy ? "Creating…" : `Create ${total} session${total === 1 ? "" : "s"}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

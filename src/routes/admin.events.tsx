import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Flag, Plus, Star, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  adminListAllEvents,
  adminListGroups,
  adminListEventReports,
  adminDismissReports,
  createEvent,
  createEventSeries,
  cancelEvent,
  setEventFeatured,
} from "@/lib/group-events-admin.functions";
import { FIELD_OPTIONS, type FieldId } from "@/lib/taxonomy";
import { SubcategoryPicker } from "@/components/subcategory-picker";
import { EVENT_KIND_OPTIONS, type EventKind } from "@/lib/events/kinds";
import { toast } from "sonner";
import { AdminImportEventDialog } from "@/components/admin-import-event-dialog";
import { VenueAutocomplete } from "@/components/event/venue-autocomplete";
import { WorkshopVenuePicker } from "@/components/event/workshop-venue-picker";
import { HackathonControlRoom } from "@/components/event/hackathon-control-room";
import { evaluateVenuePolicy, getWorkshopVenue } from "@/lib/events/workshop-venues";
import { CoverImagePicker } from "@/components/event/cover-image-picker";
import { SeedChicagoButton } from "@/components/admin/seed-chicago-button";
import { workshopEntityUrl } from "@/lib/entities/kinds";

export const Route = createFileRoute("/admin/events")({
  component: AdminEventsPage,
});

const AUTOCANCEL_KEY = "admin-events-autocancel";
const AUTOCANCEL_THRESHOLD = 3;

function AdminEventsPage() {
  const listFn = useServerFn(adminListAllEvents);
  const setFeatFn = useServerFn(setEventFeatured);
  const cancelFn = useServerFn(cancelEvent);
  const qc = useQueryClient();
  const { data: events, refetch } = useQuery({
    queryKey: ["admin-events"],
    queryFn: () => listFn(),
  });

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-2xl text-ink">Events</h2>
        <div className="flex items-center gap-2">
          <SeedChicagoButton onSeeded={() => { qc.invalidateQueries({ queryKey: ["admin-events"] }); }} />
          <AdminImportEventDialog onCreated={() => { qc.invalidateQueries({ queryKey: ["admin-events"] }); }} />
          <CreateEventDialog onCreated={() => { qc.invalidateQueries({ queryKey: ["admin-events"] }); }} />
        </div>

      </div>

      <ReportsAlertStrip onAnyChange={() => { qc.invalidateQueries({ queryKey: ["admin-events"] }); }} />

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-3 py-2">Event</th>
              <th className="px-3 py-2">Group</th>
              <th className="px-3 py-2">Starts</th>
              <th className="px-3 py-2">Going</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(events ?? []).map((e) => {
              type R = { id: string; slug: string; title: string; kind: string; starts_at: string; ends_at?: string | null; status: string; featured_at: string | null; going_count: number; capacity: number | null; group: { slug: string; name: string } };
              const ev = e as unknown as R;
              return (
                <tr key={ev.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <a href={workshopEntityUrl({ kind: "event", groupSlug: ev.group.slug, slug: ev.slug })} className="font-medium text-ink hover:underline" target="_blank" rel="noreferrer">
                      {ev.title}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-ink-soft">{ev.group.name}</td>
                  <td className="px-3 py-2 text-ink-soft">{new Date(ev.starts_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                  <td className="px-3 py-2">{ev.going_count}{ev.capacity ? ` / ${ev.capacity}` : ""}</td>
                  <td className="px-3 py-2"><span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{ev.status}</span></td>
                  <td className="px-3 py-2 text-right">
                    {ev.kind === "hackathon" && (
                      <HackathonControlRoom
                        eventId={ev.id}
                        eventTitle={ev.title}
                        startsAt={ev.starts_at}
                        endsAt={ev.ends_at ?? null}
                        seats={ev.capacity}
                      />
                    )}
                    <Button
                      size="sm"
                      variant={ev.featured_at ? "default" : "ghost"}
                      className="mr-1 h-7 rounded-md"
                      onClick={async () => {
                        await setFeatFn({ data: { id: ev.id, featured: !ev.featured_at } });
                        refetch();
                      }}
                    >
                      <Star className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 rounded-md text-destructive"
                      onClick={async () => {
                        if (!confirm("Cancel this event? RSVPs will be notified.")) return;
                        await cancelFn({ data: { id: ev.id } });
                        refetch();
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {(events ?? []).length === 0 && (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-ink-muted">No events yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateEventDialog({ onCreated }: { onCreated: () => void }) {
  const groupsFn = useServerFn(adminListGroups);
  const createFn = useServerFn(createEvent);
  const seriesFn = useServerFn(createEventSeries);
  const [open, setOpen] = useState(false);
  const { data: groups } = useQuery({ queryKey: ["admin-events-groups"], queryFn: () => groupsFn(), enabled: open });

  type FormState = {
    group_id: string; title: string; tagline: string; description: string;
    kind: EventKind;
    creative_category: "" | FieldId;
    subcategory: string | null;
    format: "in_person" | "online" | "hybrid";
    cover_url: string; starts_at: string; ends_at: string;
    venue_name: string; venue_address: string; online_url: string;
    venue_lat: number | null; venue_lng: number | null;
    venue_city_id: string | null; city_label: string | null;
    capacity: string; overflow: string; featured: boolean;
    workshop_venue_key: string | null; venue_policy_confirmed: boolean;
    lineup_capacity: string;
    // v2
    source: "workshop" | "external";
    external_url: string;
    external_organizer: string;
    is_recurring: boolean;
    recurrence_rule: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
    recurrence_label: string;
    pinned: boolean;
  };
  const [form, setForm] = useState<FormState>({
    group_id: "",
    title: "",
    tagline: "",
    description: "",
    kind: "open_mic",
    creative_category: "",
    subcategory: null,
    format: "in_person",
    cover_url: "",
    starts_at: "",
    ends_at: "",
    venue_name: "",
    venue_address: "",
    venue_lat: null,
    venue_lng: null,
    venue_city_id: null,
    city_label: null,
    online_url: "",
    capacity: "",
    overflow: "",
    workshop_venue_key: null,
    venue_policy_confirmed: false,
    featured: false,
    lineup_capacity: "",
    source: "workshop",
    external_url: "",
    external_organizer: "",
    is_recurring: false,
    recurrence_rule: "WEEKLY",
    recurrence_label: "",
    pinned: false,
  });
  const [extraGroupIds, setExtraGroupIds] = useState<string[]>([]);

  const [saving, setSaving] = useState<null | "draft" | "publish">(null);

  async function submit(e: React.FormEvent, mode: "draft" | "publish" = "publish") {
    e.preventDefault();
    if (!form.group_id || !form.title) {
      toast.error("Group and title are required.");
      return;
    }
    if (mode === "publish" && (!form.starts_at || !form.ends_at)) {
      toast.error("Start and end are required to publish. Save it as a draft instead.");
      return;
    }
    if (mode === "publish" && form.source === "external" && !form.external_url) {
      toast.error("External events need a URL.");
      return;
    }
    setSaving(mode);
    try {
      const payload = {
        group_id: form.group_id,
        title: form.title,
        tagline: form.tagline || null,
        description: form.description || null,
        kind: form.kind,
        creative_category: form.creative_category || null,
        subcategory: form.creative_category ? form.subcategory : null,
        format: form.format,
        cover_url: form.cover_url || null,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : new Date().toISOString(),
        ends_at: form.ends_at
          ? new Date(form.ends_at).toISOString()
          : new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        venue_name: form.venue_name || null,
        venue_address: form.venue_address || null,
        venue_lat: form.venue_lat,
        venue_lng: form.venue_lng,
        venue_city_id: form.venue_city_id,
        online_url: form.online_url || null,
        capacity: form.capacity ? Number(form.capacity) : null,
        overflow: form.capacity && form.overflow ? Math.max(0, Number(form.overflow)) : 0,
        workshop_venue_key: form.workshop_venue_key,
        venue_policy_confirmed: form.venue_policy_confirmed,
        status: mode === "draft" ? ("draft" as const) : ("scheduled" as const),
        featured: form.featured,
        is_official: form.source === "workshop",
        lineup_capacity: form.lineup_capacity ? Number(form.lineup_capacity) : null,
        source: form.source,
        external_url: form.source === "external" ? (form.external_url || null) : null,
        external_organizer: form.source === "external" ? (form.external_organizer || null) : null,
        is_recurring: form.is_recurring,
        recurrence_label: form.is_recurring ? (form.recurrence_label || null) : null,
        pinned: form.pinned,
        extra_group_ids: extraGroupIds.filter((id) => id !== form.group_id),
      };
      if (form.is_recurring) {
        const res = await seriesFn({
          data: { ...payload, recurrence_rule: form.recurrence_rule },
        });
        toast.success(
          `Recurring series created — ${res.count} occurrence${res.count === 1 ? "" : "s"} scheduled. More will roll in automatically.`,
        );
      } else {
        await createFn({ data: payload });
        toast.success(mode === "draft" ? "Draft saved — only you can see it" : "Event published");
      }
      setOpen(false);
      onCreated();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full"><Plus className="mr-1 h-4 w-4" /> New event</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Create event</DialogTitle></DialogHeader>
        <form onSubmit={(e) => submit(e, "publish")} className="space-y-3">
          <div>
            <Label>Primary group</Label>
            <Select value={form.group_id} onValueChange={(v) => setForm({ ...form, group_id: v })}>
              <SelectTrigger><SelectValue placeholder="Choose group" /></SelectTrigger>
              <SelectContent>
                {(groups ?? []).map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[11px] text-ink-muted">Owns the event URL and notifications.</p>
          </div>
          {form.group_id && (
            <div className="rounded-2xl border border-border bg-muted/30 p-3 space-y-2">
              <Label>Also show in (optional)</Label>
              <p className="text-[11px] text-ink-muted">The event will appear on each selected group's Events tab.</p>
              {extraGroupIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {extraGroupIds.map((gid) => {
                    const g = (groups ?? []).find((x) => x.id === gid);
                    if (!g) return null;
                    return (
                      <span key={gid} className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-xs">
                        {g.name}
                        <button type="button" className="text-ink-muted hover:text-ink" onClick={() => setExtraGroupIds((prev) => prev.filter((id) => id !== gid))}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              <Select
                value=""
                onValueChange={(v) => {
                  if (v && !extraGroupIds.includes(v)) setExtraGroupIds((prev) => [...prev, v]);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Add another group…" /></SelectTrigger>
                <SelectContent>
                  {(groups ?? [])
                    .filter((g) => g.id !== form.group_id && !extraGroupIds.includes(g.id))
                    .map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="rounded-2xl border border-border bg-muted/30 p-3 space-y-2">
            <Label>Source</Label>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-1.5">
                <input type="radio" name="src" checked={form.source === "workshop"} onChange={() => setForm({ ...form, source: "workshop" })} />
                Workshop event
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" name="src" checked={form.source === "external"} onChange={() => setForm({ ...form, source: "external" })} />
                External event
              </label>
            </div>
            {form.source === "external" && (
              <div className="space-y-2">
                <div>
                  <Label>Event URL (required)</Label>
                  <Input value={form.external_url} onChange={(e) => setForm({ ...form, external_url: e.target.value })} placeholder="https://…" />
                </div>
                <div>
                  <Label>Organizer name (optional)</Label>
                  <Input value={form.external_organizer} onChange={(e) => setForm({ ...form, external_organizer: e.target.value })} placeholder="Cole's Bar, Chicago Reader…" />
                </div>
              </div>
            )}
          </div>
          <div>
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <Label>Tagline</Label>
            <Input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} maxLength={140} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Kind</Label>
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as typeof form.kind })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_KIND_OPTIONS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Field</Label>
              <Select
                value={form.creative_category || "none"}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    creative_category: v === "none" ? "" : (v as FieldId),
                    // A specialization only survives while its Field does.
                    subcategory: null,
                  })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {FIELD_OPTIONS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.creative_category ? (
              <div className="col-span-2">
                <SubcategoryPicker
                  field={form.creative_category}
                  value={form.subcategory}
                  onChange={(next) => setForm({ ...form, subcategory: next })}
                />
              </div>
            ) : null}
            <div>
              <Label>Format</Label>
              <Select value={form.format} onValueChange={(v) => setForm({ ...form, format: v as typeof form.format })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_person">In person</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Starts</Label>
              <Input
                type="datetime-local"
                className="rounded-xl"
                value={form.starts_at}
                onChange={(e) => {
                  const starts_at = e.target.value;
                  setForm((prev) => {
                    let ends_at = prev.ends_at;
                    if (!ends_at && starts_at) {
                      try {
                        const d = new Date(starts_at);
                        d.setHours(d.getHours() + 2);
                        const pad = (n: number) => String(n).padStart(2, "0");
                        ends_at = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                      } catch { /* ignore */ }
                    }
                    return { ...prev, starts_at, ends_at };
                  });
                }}
              />
            </div>
            <div>
              <Label>Ends</Label>
              <Input type="datetime-local" className="rounded-xl" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
            </div>
          </div>
          <CoverImagePicker
            value={form.cover_url}
            onChange={(url) => setForm({ ...form, cover_url: url })}
          />
          {(form.format === "in_person" || form.format === "hybrid") && (
            <div className="space-y-3">
            <WorkshopVenuePicker
              selectedKey={form.workshop_venue_key}
              onSelect={(venue, resolved) =>
                setForm((prev) => ({
                  ...prev,
                  workshop_venue_key: venue.key,
                  venue_policy_confirmed: false,
                  venue_name: resolved.venue_name,
                  venue_address: resolved.venue_address,
                  venue_lat: resolved.venue_lat ?? prev.venue_lat,
                  venue_lng: resolved.venue_lng ?? prev.venue_lng,
                  venue_city_id: resolved.venue_city_id ?? prev.venue_city_id,
                  city_label: resolved.city_label ?? prev.city_label,
                }))
              }
            />
            <VenueAutocomplete
              venueName={form.venue_name}
              venueAddress={form.venue_address}
              cityLabel={form.city_label}
              onChange={(next) =>
                setForm((prev) => ({
                  ...prev,
                  // Any hand-entered or searched venue detaches the canonical record.
                  workshop_venue_key:
                    next.venue_name === getWorkshopVenue(prev.workshop_venue_key)?.venue_name
                      ? prev.workshop_venue_key
                      : null,
                  venue_name: next.venue_name,
                  venue_address: next.venue_address,
                  venue_lat: next.venue_lat ?? prev.venue_lat,
                  venue_lng: next.venue_lng ?? prev.venue_lng,
                  venue_city_id: next.venue_city_id ?? prev.venue_city_id,
                  city_label: next.city_label ?? prev.city_label,
                }))
              }
            />
            </div>
          )}
          {(form.format === "online" || form.format === "hybrid") && (
            <div>
              <Label>Online URL (Zoom etc.)</Label>
              <Input className="rounded-xl" value={form.online_url} onChange={(e) => setForm({ ...form, online_url: e.target.value })} />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Capacity (optional)</Label>
              <Input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
              <p className="mt-1 text-[11px] text-ink-muted">How many people this Event is intended for.</p>
            </div>
            <div>
              <Label>Overflow</Label>
              <Input
                type="number"
                min={0}
                disabled={!form.capacity}
                value={form.overflow}
                onChange={(e) => setForm({ ...form, overflow: e.target.value })}
              />
              <p className="mt-1 text-[11px] text-ink-muted">
                Additional RSVPs to accept for expected cancellations or no-shows.
              </p>
            </div>
          </div>
          <VenuePolicyStrip form={form} setForm={(u) => setForm((prev) => u(prev))} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
            Feature on homepage
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />
            Pin to top of the group's Events tab
          </label>
          <div className="rounded-2xl border border-border bg-muted/30 p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_recurring} onChange={(e) => setForm({ ...form, is_recurring: e.target.checked })} />
              Recurring event
            </label>
            {form.is_recurring && (
              <div className="space-y-2">
                <div>
                  <Label>Repeats</Label>
                  <Select
                    value={form.recurrence_rule}
                    onValueChange={(v) => setForm({ ...form, recurrence_rule: v as "WEEKLY" | "BIWEEKLY" | "MONTHLY" })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WEEKLY">Weekly</SelectItem>
                      <SelectItem value="BIWEEKLY">Every 2 weeks</SelectItem>
                      <SelectItem value="MONTHLY">Monthly (same date)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-[11px] text-ink-muted">
                    New occurrences roll in automatically (about 8 weeks ahead). Each date is its own page and its own RSVP. Cancel the series from any occurrence's admin bar to stop future dates.
                  </p>
                </div>
                <div>
                  <Label>Schedule caption (optional)</Label>
                  <Input
                    value={form.recurrence_label}
                    onChange={(e) => setForm({ ...form, recurrence_label: e.target.value })}
                    placeholder="Every Tuesday · First Friday of the month"
                    maxLength={80}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-border bg-muted/30 p-3">
            <Label>Lineup spots (optional)</Label>
            <Input
              type="number"
              min={1}
              max={200}
              value={form.lineup_capacity}
              onChange={(e) => setForm({ ...form, lineup_capacity: e.target.value })}
              placeholder="e.g. 10 — leave blank for no lineup"
            />
            <p className="mt-1.5 text-[11px] text-ink-muted">
              When set, anyone signed in can self-sign up. Extras go to a waitlist and auto-promote when spots open. First come, first served.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-md"
              disabled={saving !== null}
              onClick={(e) => submit(e, "draft")}
            >
              {saving === "draft" ? "Saving…" : "Save draft"}
            </Button>
            <Button type="submit" className="flex-1 rounded-md" disabled={saving !== null}>
              {saving === "publish" ? "Publishing…" : "Publish Event"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReportsAlertStrip({ onAnyChange }: { onAnyChange: () => void }) {
  const listFn = useServerFn(adminListEventReports);
  const dismissFn = useServerFn(adminDismissReports);
  const cancelFn = useServerFn(cancelEvent);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-event-reports"],
    queryFn: () => listFn(),
    refetchInterval: 60_000,
  });
  const [auto, setAuto] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(AUTOCANCEL_KEY) === "1";
  });
  const acted = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!auto || !data) return;
    (async () => {
      for (const row of data) {
        const r = row as { event: { id: string; title: string; status: string }; report_ids: string[] };
        if (acted.current.has(r.event.id)) continue;
        if (r.event.status === "canceled") continue;
        if (r.report_ids.length < AUTOCANCEL_THRESHOLD) continue;
        acted.current.add(r.event.id);
        try {
          await cancelFn({ data: { id: r.event.id, reason: "Auto-canceled: multiple reports as not a real event." } });
          await dismissFn({ data: { report_ids: r.report_ids } });
          toast.success(`Auto-canceled "${r.event.title}"`);
          qc.invalidateQueries({ queryKey: ["admin-event-reports"] });
          onAnyChange();
        } catch (ex) {
          toast.error((ex as Error).message);
        }
      }
    })();
  }, [auto, data, cancelFn, dismissFn, qc, onAnyChange]);

  const rows = (data ?? []) as {
    event: { id: string; slug: string; title: string; status: string; group: { slug: string; name: string } };
    report_ids: string[];
    reasons: string[];
  }[];

  if (rows.length === 0) return null;

  return (
    <div className="mb-4 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
          <Flag className="h-4 w-4" />
          <span className="font-medium">{rows.length} event{rows.length === 1 ? "" : "s"} reported</span>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-ink-soft">
          <input
            type="checkbox"
            checked={auto}
            onChange={(e) => {
              setAuto(e.target.checked);
              if (typeof window !== "undefined") {
                window.localStorage.setItem(AUTOCANCEL_KEY, e.target.checked ? "1" : "0");
              }
            }}
          />
          Auto-cancel after {AUTOCANCEL_THRESHOLD} reports
        </label>
      </div>
      <ul className="mt-2 divide-y divide-amber-500/20">
        {rows.map((r) => {
          const notEvent = r.reasons.filter((x) => x === "not_an_event").length;
          return (
            <li key={r.event.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <a
                href={workshopEntityUrl({ kind: "event", groupSlug: r.event.group.slug, slug: r.event.slug })}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-ink hover:underline"
              >
                {r.event.title}
              </a>
              <span className="text-xs text-ink-muted">
                {r.event.group.name} · {r.report_ids.length} report{r.report_ids.length === 1 ? "" : "s"}
                {notEvent > 0 ? ` · ${notEvent} "not an event"` : ""}
                {r.event.status === "canceled" ? " · already canceled" : ""}
              </span>
              <div className="ml-auto flex items-center gap-1">
                {r.event.status !== "canceled" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 rounded-md text-destructive"
                    onClick={async () => {
                      if (!confirm(`Cancel "${r.event.title}"? RSVPs will be notified.`)) return;
                      await cancelFn({ data: { id: r.event.id, reason: "Reported as not a real event." } });
                      await dismissFn({ data: { report_ids: r.report_ids } });
                      qc.invalidateQueries({ queryKey: ["admin-event-reports"] });
                      onAnyChange();
                    }}
                  >
                    Cancel event
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 rounded-md"
                  onClick={async () => {
                    await dismissFn({ data: { report_ids: r.report_ids } });
                    qc.invalidateQueries({ queryKey: ["admin-event-reports"] });
                  }}
                >
                  <X className="mr-1 h-3 w-3" /> Dismiss
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Live "up to N RSVPs" summary plus the canonical venue's published group
 * policy. The same rule is enforced server-side — this strip only surfaces it
 * early and lets an admin record that they went through the venue's own flow.
 */
function VenuePolicyStrip<
  T extends {
    capacity: string;
    overflow: string;
    workshop_venue_key: string | null;
    venue_policy_confirmed: boolean;
  },
>({ form, setForm }: { form: T; setForm: (updater: (prev: T) => T) => void }) {
  const capacity = form.capacity ? Number(form.capacity) : null;
  const overflow = capacity && form.overflow ? Math.max(0, Number(form.overflow)) : 0;
  const policy = evaluateVenuePolicy({
    key: form.workshop_venue_key,
    capacity,
    overflow,
    confirmed: form.venue_policy_confirmed,
  });
  if (capacity == null && !policy.reason) return null;
  return (
    <div className="rounded-2xl border border-border bg-muted/20 p-3 text-sm">
      {capacity != null && (
        <p className="text-ink-soft">
          Up to <span className="font-medium text-ink">{capacity + overflow}</span> RSVPs will be
          accepted: {capacity} intended + {overflow} overflow.
        </p>
      )}
      {policy.reason && (
        <div className="mt-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5">
          <p className="text-[13px] leading-snug text-ink">{policy.reason}</p>
          <label className="mt-2 flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={form.venue_policy_confirmed}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, venue_policy_confirmed: e.target.checked }))
              }
            />
            I confirmed this occurrence through the venue&apos;s own flow.
          </label>
        </div>
      )}
    </div>
  );
}

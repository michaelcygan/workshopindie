import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Star, Trash2 } from "lucide-react";
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
  createEvent,
  cancelEvent,
  setEventFeatured,
} from "@/lib/group-events-admin.functions";
import { toast } from "sonner";
import { AdminImportEventDialog } from "@/components/admin-import-event-dialog";

export const Route = createFileRoute("/admin/events")({
  component: AdminEventsPage,
});

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
        <CreateEventDialog onCreated={() => { qc.invalidateQueries({ queryKey: ["admin-events"] }); }} />
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-3 py-2">Event</th>
              <th className="px-3 py-2">Group</th>
              <th className="px-3 py-2">Starts</th>
              <th className="px-3 py-2">Going</th>
              <th className="px-3 py-2">Promo</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(events ?? []).map((e) => {
              type R = { id: string; slug: string; title: string; starts_at: string; status: string; featured_at: string | null; going_count: number; capacity: number | null; promo_pass_months: number; group: { slug: string; name: string } };
              const ev = e as unknown as R;
              return (
                <tr key={ev.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <a href={`/g/${ev.group.slug}/e/${ev.slug}`} className="font-medium text-ink hover:underline" target="_blank" rel="noreferrer">
                      {ev.title}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-ink-soft">{ev.group.name}</td>
                  <td className="px-3 py-2 text-ink-soft">{new Date(ev.starts_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                  <td className="px-3 py-2">{ev.going_count}{ev.capacity ? ` / ${ev.capacity}` : ""}</td>
                  <td className="px-3 py-2">{ev.promo_pass_months}mo</td>
                  <td className="px-3 py-2"><span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{ev.status}</span></td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant={ev.featured_at ? "default" : "ghost"}
                      className="mr-1 h-7 rounded-full"
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
                      className="h-7 rounded-full text-destructive"
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
              <tr><td colSpan={7} className="px-3 py-10 text-center text-ink-muted">No events yet.</td></tr>
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
  const [open, setOpen] = useState(false);
  const { data: groups } = useQuery({ queryKey: ["admin-events-groups"], queryFn: () => groupsFn(), enabled: open });

  type FormState = {
    group_id: string; title: string; tagline: string; description: string;
    kind: "open_mic" | "listening_party" | "networking" | "screening" | "workshop_irl" | "online" | "other";
    format: "in_person" | "online" | "hybrid";
    cover_url: string; starts_at: string; ends_at: string;
    venue_name: string; venue_address: string; online_url: string;
    capacity: string; promo_pass_months: number; featured: boolean;
  };
  const [form, setForm] = useState<FormState>({
    group_id: "",
    title: "",
    tagline: "",
    description: "",
    kind: "open_mic",
    format: "in_person",
    cover_url: "",
    starts_at: "",
    ends_at: "",
    venue_name: "",
    venue_address: "",
    online_url: "",
    capacity: "",
    promo_pass_months: 1,
    featured: false,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.group_id || !form.title || !form.starts_at || !form.ends_at) {
      toast.error("Group, title, start and end are required.");
      return;
    }
    try {
      await createFn({
        data: {
          group_id: form.group_id,
          title: form.title,
          tagline: form.tagline || null,
          description: form.description || null,
          kind: form.kind,
          format: form.format,
          cover_url: form.cover_url || null,
          starts_at: new Date(form.starts_at).toISOString(),
          ends_at: new Date(form.ends_at).toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          venue_name: form.venue_name || null,
          venue_address: form.venue_address || null,
          online_url: form.online_url || null,
          capacity: form.capacity ? Number(form.capacity) : null,
          promo_pass_months: form.promo_pass_months,
          featured: form.featured,
          is_official: true,
        },
      });
      toast.success("Event created");
      setOpen(false);
      onCreated();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full"><Plus className="mr-1 h-4 w-4" /> New event</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Create event</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Group</Label>
            <Select value={form.group_id} onValueChange={(v) => setForm({ ...form, group_id: v })}>
              <SelectTrigger><SelectValue placeholder="Choose group" /></SelectTrigger>
              <SelectContent>
                {(groups ?? []).map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                  {["open_mic", "listening_party", "networking", "screening", "workshop_irl", "online", "other"].map((k) => (
                    <SelectItem key={k} value={k}>{k.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
            </div>
            <div>
              <Label>Ends</Label>
              <Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Cover image URL</Label>
            <Input value={form.cover_url} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} placeholder="https://…" />
          </div>
          {(form.format === "in_person" || form.format === "hybrid") && (
            <>
              <div>
                <Label>Venue name</Label>
                <Input value={form.venue_name} onChange={(e) => setForm({ ...form, venue_name: e.target.value })} />
              </div>
              <div>
                <Label>Venue address</Label>
                <Input value={form.venue_address} onChange={(e) => setForm({ ...form, venue_address: e.target.value })} />
              </div>
            </>
          )}
          {(form.format === "online" || form.format === "hybrid") && (
            <div>
              <Label>Online URL (Zoom etc.)</Label>
              <Input value={form.online_url} onChange={(e) => setForm({ ...form, online_url: e.target.value })} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Capacity (optional)</Label>
              <Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            </div>
            <div>
              <Label>Promo months</Label>
              <Input type="number" min={0} max={36} value={form.promo_pass_months} onChange={(e) => setForm({ ...form, promo_pass_months: Number(e.target.value) })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
            Feature on homepage
          </label>
          <Button type="submit" className="w-full rounded-full">Create event</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

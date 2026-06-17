import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { importEventFromUrl } from "@/lib/event-import.functions";
import { adminListGroups, createEvent } from "@/lib/group-events-admin.functions";
import { toast } from "sonner";

type Kind = "open_mic" | "listening_party" | "networking" | "screening" | "workshop_irl" | "online" | "other";
type Format = "in_person" | "online" | "hybrid";

type FormState = {
  group_id: string;
  title: string;
  tagline: string;
  description: string;
  kind: Kind;
  format: Format;
  cover_url: string;
  starts_at: string;
  ends_at: string;
  venue_name: string;
  venue_address: string;
  online_url: string;
  capacity: string;
};

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AdminImportEventDialog({ onCreated }: { onCreated: () => void }) {
  const importFn = useServerFn(importEventFromUrl);
  const groupsFn = useServerFn(adminListGroups);
  const createFn = useServerFn(createEvent);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"paste" | "review">("paste");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [source, setSource] = useState<{ url: string; host: string } | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [edited, setEdited] = useState<Set<keyof FormState>>(new Set());
  const [form, setForm] = useState<FormState>({
    group_id: "", title: "", tagline: "", description: "",
    kind: "other", format: "in_person", cover_url: "",
    starts_at: "", ends_at: "",
    venue_name: "", venue_address: "", online_url: "", capacity: "",
  });

  const { data: groups } = useQuery({
    queryKey: ["admin-events-groups"],
    queryFn: () => groupsFn(),
    enabled: open,
  });

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setEdited((s) => { const n = new Set(s); n.add(k); return n; });
  }

  function reset() {
    setStep("paste"); setUrl(""); setErr(null); setBusy(false);
    setSource(null); setWarnings([]); setEdited(new Set());
    setForm({
      group_id: "", title: "", tagline: "", description: "",
      kind: "other", format: "in_person", cover_url: "",
      starts_at: "", ends_at: "",
      venue_name: "", venue_address: "", online_url: "", capacity: "",
    });
  }

  async function fetchDraft(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = await importFn({ data: { url: url.trim() } });
      setSource({ url: res.source.url, host: res.source.host });
      setWarnings(res.warnings);
      setForm({
        group_id: "",
        title: res.draft.title ?? "",
        tagline: res.draft.tagline ?? "",
        description: res.draft.description ?? "",
        kind: res.draft.kind,
        format: res.draft.format,
        cover_url: res.draft.cover_url ?? "",
        starts_at: toLocalInput(res.draft.starts_at),
        ends_at: toLocalInput(res.draft.ends_at),
        venue_name: res.draft.venue_name ?? "",
        venue_address: res.draft.venue_address ?? "",
        online_url: res.draft.online_url ?? "",
        capacity: res.draft.capacity ? String(res.draft.capacity) : "",
      });
      setStep("review");
    } catch (ex) {
      setErr((ex as Error).message || "Couldn't read that page.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(publish: boolean) {
    if (!form.group_id || !form.title || !form.starts_at || !form.ends_at) {
      toast.error("Group, title, start and end are required.");
      return;
    }
    setBusy(true);
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
          promo_pass_months: 0,
          featured: false,
          is_official: true,
          status: publish ? "scheduled" : "draft",
        },
      });
      toast.success(publish ? "Event published" : "Draft saved");
      setOpen(false); reset(); onCreated();
    } catch (ex) {
      toast.error((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const aiHint = (k: keyof FormState) =>
    !edited.has(k) && form[k] ? (
      <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-primary"><Sparkles className="h-3 w-3" /> auto-filled</span>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-full"><Link2 className="mr-1 h-4 w-4" /> Import from link</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{step === "paste" ? "Import event from link" : "Review draft"}</DialogTitle>
        </DialogHeader>

        {step === "paste" && (
          <form onSubmit={fetchDraft} className="space-y-3">
            <div>
              <Label>Event URL</Label>
              <Input
                type="url"
                placeholder="https://eventbrite.com/e/... or https://partiful.com/e/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
              <p className="mt-1 text-xs text-ink-muted">
                Works best with Eventbrite, Luma, Partiful, and most public event pages.
              </p>
            </div>
            {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
            <Button type="submit" disabled={busy || !url} className="w-full rounded-full">
              {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reading page…</> : "Fetch event"}
            </Button>
          </form>
        )}

        {step === "review" && (
          <div className="space-y-3">
            {source && (
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs text-ink-soft">
                <span>Imported from <span className="font-medium text-ink">{source.host}</span></span>
                <a href={source.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">View source</a>
              </div>
            )}
            {warnings.length > 0 && (
              <ul className="space-y-1 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                {warnings.map((w, i) => <li key={i}>• {w}</li>)}
              </ul>
            )}

            <div>
              <Label>Group <span className="text-destructive">*</span></Label>
              <Select value={form.group_id} onValueChange={(v) => update("group_id", v)}>
                <SelectTrigger><SelectValue placeholder="Choose group" /></SelectTrigger>
                <SelectContent>
                  {(groups ?? []).map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Title{aiHint("title")}</Label>
              <Input value={form.title} onChange={(e) => update("title", e.target.value)} />
            </div>
            <div>
              <Label>Tagline</Label>
              <Input value={form.tagline} onChange={(e) => update("tagline", e.target.value)} maxLength={140} />
            </div>
            <div>
              <Label>Description{aiHint("description")}</Label>
              <Textarea rows={5} value={form.description} onChange={(e) => update("description", e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kind{aiHint("kind")}</Label>
                <Select value={form.kind} onValueChange={(v) => update("kind", v as Kind)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["open_mic", "listening_party", "networking", "screening", "workshop_irl", "online", "other"].map((k) => (
                      <SelectItem key={k} value={k}>{k.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Format{aiHint("format")}</Label>
                <Select value={form.format} onValueChange={(v) => update("format", v as Format)}>
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
                <Label>Starts{aiHint("starts_at")}</Label>
                <Input type="datetime-local" value={form.starts_at} onChange={(e) => update("starts_at", e.target.value)} />
              </div>
              <div>
                <Label>Ends{aiHint("ends_at")}</Label>
                <Input type="datetime-local" value={form.ends_at} onChange={(e) => update("ends_at", e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Cover image URL{aiHint("cover_url")}</Label>
              <Input value={form.cover_url} onChange={(e) => update("cover_url", e.target.value)} placeholder="https://…" />
            </div>

            {(form.format === "in_person" || form.format === "hybrid") && (
              <>
                <div>
                  <Label>Venue name{aiHint("venue_name")}</Label>
                  <Input value={form.venue_name} onChange={(e) => update("venue_name", e.target.value)} />
                </div>
                <div>
                  <Label>Venue address{aiHint("venue_address")}</Label>
                  <Input value={form.venue_address} onChange={(e) => update("venue_address", e.target.value)} />
                </div>
              </>
            )}
            {(form.format === "online" || form.format === "hybrid") && (
              <div>
                <Label>Online URL{aiHint("online_url")}</Label>
                <Input value={form.online_url} onChange={(e) => update("online_url", e.target.value)} />
              </div>
            )}

            <div>
              <Label>Capacity (optional)</Label>
              <Input type="number" value={form.capacity} onChange={(e) => update("capacity", e.target.value)} />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1 rounded-full" disabled={busy} onClick={() => submit(false)}>
                Save as draft
              </Button>
              <Button type="button" className="flex-1 rounded-full" disabled={busy} onClick={() => submit(true)}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish now"}
              </Button>
            </div>
            <button type="button" className="w-full text-xs text-ink-muted hover:text-ink" onClick={() => setStep("paste")}>
              ← Try a different link
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

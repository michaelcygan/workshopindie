import { normalizeUrlOrKeep } from "@/lib/url-normalize";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link2, Loader2, Sparkles, Repeat, AlertCircle, CheckCircle2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  importEventFromUrl,
  importEventsFromUrls,
  type BulkImportRow,
} from "@/lib/event-import.functions";
import {
  adminListGroups,
  createEvent,
  createEventSeries,
} from "@/lib/group-events-admin.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Kind = "open_mic" | "listening_party" | "networking" | "screening" | "workshop_irl" | "online" | "other";
type Format = "in_person" | "online" | "hybrid";
type Rule = "ONCE" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";

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
  rule: Rule;
  occurrences: number;
};

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function emptyForm(): FormState {
  return {
    group_id: "", title: "", tagline: "", description: "",
    kind: "other", format: "in_person", cover_url: "",
    starts_at: "", ends_at: "",
    venue_name: "", venue_address: "", online_url: "", capacity: "",
    rule: "ONCE", occurrences: 8,
  };
}

export function AdminImportEventDialog({ onCreated }: { onCreated: () => void }) {
  const importFn = useServerFn(importEventFromUrl);
  const bulkFn = useServerFn(importEventsFromUrls);
  const groupsFn = useServerFn(adminListGroups);
  const createFn = useServerFn(createEvent);
  const seriesFn = useServerFn(createEventSeries);

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"single" | "bulk">("single");

  // Single flow
  const [step, setStep] = useState<"paste" | "review">("paste");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [source, setSource] = useState<{ url: string; host: string; parser?: string } | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [edited, setEdited] = useState<Set<keyof FormState>>(new Set());
  const [form, setForm] = useState<FormState>(emptyForm());

  // Bulk flow
  const [bulkText, setBulkText] = useState("");
  const [bulkGroupId, setBulkGroupId] = useState("");
  const [bulkResults, setBulkResults] = useState<BulkImportRow[] | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkErr, setBulkErr] = useState<string | null>(null);
  const [editingBulk, setEditingBulk] = useState<number | null>(null);

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
    setForm(emptyForm());
    setBulkText(""); setBulkResults(null); setBulkBusy(false); setBulkErr(null);
    setEditingBulk(null); setTab("single");
  }

  async function fetchDraft(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = await importFn({ data: { url: url.trim() } });
      loadDraftIntoForm(res.draft, res.source, res.warnings);
      setStep("review");
    } catch (ex) {
      setErr((ex as Error).message || "Couldn't read that page.");
    } finally {
      setBusy(false);
    }
  }

  function loadDraftIntoForm(
    draft: { title: string; tagline: string | null; description: string | null; kind: Kind; format: Format; cover_url: string | null; starts_at: string | null; ends_at: string | null; venue_name: string | null; venue_address: string | null; online_url: string | null; capacity: number | null; recurrence: { rule: "WEEKLY" | "BIWEEKLY" | "MONTHLY"; hint: string } | null },
    src: { url: string; host: string; parser?: string },
    warn: string[],
  ) {
    setSource({ url: src.url, host: src.host, parser: src.parser });
    setWarnings(warn);
    setEdited(new Set());
    setForm({
      group_id: bulkGroupId || "",
      title: draft.title ?? "",
      tagline: draft.tagline ?? "",
      description: draft.description ?? "",
      kind: draft.kind,
      format: draft.format,
      cover_url: draft.cover_url ?? "",
      starts_at: toLocalInput(draft.starts_at),
      ends_at: toLocalInput(draft.ends_at),
      venue_name: draft.venue_name ?? "",
      venue_address: draft.venue_address ?? "",
      online_url: draft.online_url ?? "",
      capacity: draft.capacity ? String(draft.capacity) : "",
      rule: draft.recurrence ? draft.recurrence.rule : "ONCE",
      occurrences: 8,
    });
  }

  function basePayload() {
    return {
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
    };
  }

  async function submit(publish: boolean) {
    if (!form.group_id || !form.title || !form.starts_at || !form.ends_at) {
      toast.error("Group, title, start and end are required.");
      return;
    }
    setBusy(true);
    try {
      if (form.rule === "ONCE") {
        await createFn({ data: { ...basePayload(), status: publish ? "scheduled" : "draft" } });
        toast.success(publish ? "Event published" : "Draft saved");
      } else {
        const res = await seriesFn({
          data: {
            ...basePayload(),
            status: publish ? "scheduled" : "draft",
            recurrence_rule: form.rule,
            occurrence_count: Math.max(1, Math.min(26, Number(form.occurrences) || 1)),
          },
        });
        toast.success(`${publish ? "Published" : "Saved"} ${res.count} occurrence${res.count === 1 ? "" : "s"}`);
      }
      // If we came from bulk, return there
      if (editingBulk !== null) {
        // mark that row as "done" by removing it
        setBulkResults((rs) => (rs ?? []).filter((_, i) => i !== editingBulk));
        setEditingBulk(null);
        setStep("paste");
        setTab("bulk");
      } else {
        setOpen(false); reset();
      }
      onCreated();
    } catch (ex) {
      toast.error((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // ---------- Bulk ----------
  async function runBulk() {
    setBulkBusy(true); setBulkErr(null); setBulkResults(null);
    try {
      const urls = bulkText
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (urls.length === 0) { setBulkErr("Paste one or more URLs."); setBulkBusy(false); return; }
      if (urls.length > 25) { setBulkErr("Max 25 URLs per batch."); setBulkBusy(false); return; }
      const res = await bulkFn({ data: { urls } });
      setBulkResults(res.results);
    } catch (ex) {
      setBulkErr((ex as Error).message || "Bulk import failed.");
    } finally {
      setBulkBusy(false);
    }
  }

  function rowStatus(r: BulkImportRow): "ready" | "needs-date" | "failed" {
    if (!r.ok) return "failed";
    if (!r.draft.starts_at || !r.draft.ends_at || !r.draft.title) return "needs-date";
    return "ready";
  }

  async function publishAllReady() {
    if (!bulkGroupId) { toast.error("Pick a group for the batch first."); return; }
    if (!bulkResults) return;
    setBulkBusy(true);
    let okCount = 0, failCount = 0;
    for (const r of bulkResults) {
      if (!r.ok) { failCount++; continue; }
      if (rowStatus(r) !== "ready") { failCount++; continue; }
      try {
        await createFn({
          data: {
            group_id: bulkGroupId,
            title: r.draft.title,
            tagline: r.draft.tagline ?? null,
            description: r.draft.description ?? null,
            kind: r.draft.kind,
            format: r.draft.format,
            cover_url: r.draft.cover_url ?? null,
            starts_at: r.draft.starts_at!,
            ends_at: r.draft.ends_at!,
            timezone: r.draft.timezone || "UTC",
            venue_name: r.draft.venue_name ?? null,
            venue_address: r.draft.venue_address ?? null,
            online_url: r.draft.online_url ?? null,
            capacity: r.draft.capacity ?? null,
            promo_pass_months: 0,
            featured: false,
            is_official: true,
            status: "draft",
          },
        });
        okCount++;
      } catch {
        failCount++;
      }
    }
    setBulkBusy(false);
    toast.success(`Saved ${okCount} as drafts${failCount ? `, ${failCount} skipped` : ""}.`);
    onCreated();
    if (okCount > 0) {
      // remove successful rows
      setBulkResults((rs) => (rs ?? []).filter((r) => !r.ok || rowStatus(r) !== "ready"));
    }
  }

  function editBulkRow(i: number) {
    const r = bulkResults?.[i];
    if (!r || !r.ok) return;
    setEditingBulk(i);
    loadDraftIntoForm(r.draft, { url: r.url, host: r.host, parser: r.parser }, r.warnings);
    setStep("review");
    setTab("single");
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
          <DialogTitle>
            {step === "review" ? (editingBulk !== null ? "Edit batch event" : "Review draft") : "Import event"}
          </DialogTitle>
        </DialogHeader>

        {step === "paste" && (
          <Tabs value={tab} onValueChange={(v) => setTab(v as "single" | "bulk")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single">Single link</TabsTrigger>
              <TabsTrigger value="bulk">Bulk (up to 25)</TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="space-y-3">
              <form onSubmit={fetchDraft} className="space-y-3">
                <div>
                  <Label>Event URL</Label>
                  <Input
                    type="url"
                    placeholder="https://eventbrite.com/e/... or https://partiful.com/e/..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onBlur={(e) => setUrl(normalizeUrlOrKeep(e.target.value))}
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
            </TabsContent>

            <TabsContent value="bulk" className="space-y-3">
              <div>
                <Label>Group for this batch</Label>
                <Select value={bulkGroupId} onValueChange={setBulkGroupId}>
                  <SelectTrigger><SelectValue placeholder="Choose group" /></SelectTrigger>
                  <SelectContent>
                    {(groups ?? []).map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>URLs (one per line, max 25)</Label>
                <Textarea
                  rows={8}
                  placeholder={"https://eventbrite.com/e/...\nhttps://lu.ma/...\nhttps://partiful.com/e/..."}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                />
              </div>
              {bulkErr && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{bulkErr}</p>}
              <Button type="button" onClick={runBulk} disabled={bulkBusy || !bulkText.trim()} className="w-full rounded-full">
                {bulkBusy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Fetching all…</> : "Fetch all"}
              </Button>

              {bulkResults && (
                <div className="space-y-2">
                  <div className="text-xs text-ink-muted">
                    {bulkResults.filter((r) => rowStatus(r) === "ready").length} ready ·{" "}
                    {bulkResults.filter((r) => rowStatus(r) === "needs-date").length} need a date ·{" "}
                    {bulkResults.filter((r) => rowStatus(r) === "failed").length} failed
                  </div>
                  <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                    {bulkResults.map((r, i) => {
                      const status = rowStatus(r);
                      return (
                        <li key={`${r.url}-${i}`} className="flex items-start gap-2 px-3 py-2 text-sm">
                          <span className="mt-0.5">
                            {status === "ready" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                            {status === "needs-date" && <AlertCircle className="h-4 w-4 text-amber-500" />}
                            {status === "failed" && <AlertCircle className="h-4 w-4 text-destructive" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium text-ink">
                              {r.ok ? (r.draft.title || "(untitled)") : r.url}
                            </div>
                            <div className="truncate text-xs text-ink-muted">
                              {r.host}{r.ok ? "" : ` — ${r.error}`}
                            </div>
                          </div>
                          {r.ok && (
                            <Button size="sm" variant="ghost" className="h-7 rounded-full" onClick={() => editBulkRow(i)}>
                              <Pencil className="mr-1 h-3 w-3" /> Edit
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      className="flex-1 rounded-full"
                      disabled={bulkBusy || !bulkResults.some((r) => rowStatus(r) === "ready")}
                      onClick={publishAllReady}
                    >
                      Save all ready as drafts
                    </Button>
                    <Button type="button" variant="outline" className="rounded-full" onClick={() => setBulkResults(null)}>
                      Clear
                    </Button>
                  </div>
                  <p className="text-[11px] text-ink-muted">
                    Tip: edit any row to review and publish individually (with recurrence options).
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {step === "review" && (
          <div className="space-y-3">
            {source && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-ink-soft">
                <span className="flex items-center gap-2">
                  <span>Imported from <span className="font-medium text-ink">{source.host}</span></span>
                  {source.parser && (
                    <span className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                      source.parser === "fallback" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                    )}>
                      {source.parser === "json-ld" ? "structured" : source.parser}
                    </span>
                  )}
                </span>
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

            {/* Repeats */}
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-ink-soft">
                <Repeat className="h-3.5 w-3.5" /> Repeats
                {form.rule !== "ONCE" && !edited.has("rule") && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-primary"><Sparkles className="h-3 w-3" /> auto-detected</span>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Select value={form.rule} onValueChange={(v) => update("rule", v as Rule)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ONCE">One-time</SelectItem>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="BIWEEKLY">Every 2 weeks</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                  </SelectContent>
                </Select>
                {form.rule !== "ONCE" && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={26}
                      value={form.occurrences}
                      onChange={(e) => update("occurrences", Math.max(1, Math.min(26, Number(e.target.value) || 1)))}
                    />
                    <span className="text-xs text-ink-muted whitespace-nowrap">occurrences</span>
                  </div>
                )}
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
            <button
              type="button"
              className="w-full text-xs text-ink-muted hover:text-ink"
              onClick={() => { setStep("paste"); if (editingBulk !== null) { setTab("bulk"); setEditingBulk(null); } }}
            >
              ← Back
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

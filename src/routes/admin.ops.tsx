import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { listFeatureFlags, upsertFeatureFlag, deleteFeatureFlag, sendAdminBroadcast, listAdminBroadcasts } from "@/lib/admin-ops.functions";

export const Route = createFileRoute("/admin/ops")({ component: OpsPage });

function OpsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listFeatureFlags);
  const upFn = useServerFn(upsertFeatureFlag);
  const delFn = useServerFn(deleteFeatureFlag);
  const sendFn = useServerFn(sendAdminBroadcast);
  const bcastFn = useServerFn(listAdminBroadcasts);

  const flags = useQuery({ queryKey: ["admin", "flags"], queryFn: () => listFn() });
  const broadcasts = useQuery({ queryKey: ["admin", "broadcasts"], queryFn: () => bcastFn() });

  const save = useMutation({
    mutationFn: (p: any) => upFn({ data: p }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["admin", "flags"] }); },
  });
  const remove = useMutation({
    mutationFn: (key: string) => delFn({ data: { key } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin", "flags"] }); },
  });

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 font-display text-xl text-ink">Feature flags</h2>
        <NewFlagForm onSave={(p) => save.mutate(p)} />
        <div className="mt-4 space-y-2">
          {(flags.data ?? []).map((f: any) => (
            <FlagRow key={f.key} flag={f} onSave={(p) => save.mutate(p)} onDelete={() => { if (confirm(`Delete flag "${f.key}"?`)) remove.mutate(f.key); }} />
          ))}
          {!(flags.data ?? []).length ? <div className="text-sm text-ink-muted">No flags yet.</div> : null}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl text-ink">In-app broadcast</h2>
        <BroadcastForm onSend={(p) => sendFn({ data: p }).then((res) => {
          toast.success(`Sent to ${res.recipients} users`);
          qc.invalidateQueries({ queryKey: ["admin", "broadcasts"] });
        }).catch((e) => toast.error(e.message ?? "Failed"))} />

        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-ink-muted">
              <tr><th className="px-3 py-2 text-left">When</th><th className="px-3 py-2 text-left">Title</th><th className="px-3 py-2 text-left">Audience</th><th className="px-3 py-2 text-right">Recipients</th></tr>
            </thead>
            <tbody>
              {(broadcasts.data ?? []).map((b: any) => (
                <tr key={b.id} className="border-t border-border">
                  <td className="px-3 py-1.5">{new Date(b.sent_at).toLocaleString()}</td>
                  <td className="px-3 py-1.5">{b.title}</td>
                  <td className="px-3 py-1.5">{b.audience?.kind ?? "—"}</td>
                  <td className="px-3 py-1.5 text-right">{b.recipients_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function NewFlagForm({ onSave }: { onSave: (p: any) => void }) {
  const [key, setKey] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [pct, setPct] = useState(0);
  const [notes, setNotes] = useState("");
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div><label className="text-xs text-ink-muted">Key</label><Input className="w-56" value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. new_compose_v2" /></div>
        <div className="flex items-center gap-2"><Switch checked={enabled} onCheckedChange={setEnabled} /> <span className="text-sm">{enabled ? "Enabled" : "Disabled"}</span></div>
        <div className="w-56"><label className="text-xs text-ink-muted">Rollout %: {pct}</label><Slider min={0} max={100} step={5} value={[pct]} onValueChange={(v) => setPct(v[0])} /></div>
        <div className="flex-1"><label className="text-xs text-ink-muted">Notes</label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <Button disabled={!key.trim()} onClick={() => onSave({ key: key.trim(), enabled, rollout_pct: pct, notes })}>Create</Button>
      </div>
    </div>
  );
}

function FlagRow({ flag, onSave, onDelete }: { flag: any; onSave: (p: any) => void; onDelete: () => void }) {
  const [enabled, setEnabled] = useState<boolean>(flag.enabled);
  const [pct, setPct] = useState<number>(flag.rollout_pct);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
      <code className="font-mono text-sm text-ink">{flag.key}</code>
      <Switch checked={enabled} onCheckedChange={setEnabled} />
      <div className="w-44 text-xs text-ink-muted">
        Rollout {pct}%
        <Slider min={0} max={100} step={5} value={[pct]} onValueChange={(v) => setPct(v[0])} />
      </div>
      <span className="flex-1 text-xs text-ink-soft">{flag.notes}</span>
      <Button size="sm" onClick={() => onSave({ key: flag.key, enabled, rollout_pct: pct, notes: flag.notes })}>Save</Button>
      <Button size="sm" variant="ghost" onClick={onDelete}>Delete</Button>
    </div>
  );
}

function BroadcastForm({ onSend }: { onSend: (p: any) => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all" | "plus" | "active_30d">("active_30d");
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div><label className="text-xs text-ink-muted">Title</label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><label className="text-xs text-ink-muted">Audience</label>
          <Select value={audience} onValueChange={(v) => setAudience(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active_30d">Active in last 30 days</SelectItem>
              <SelectItem value="plus">Plus subscribers</SelectItem>
              <SelectItem value="all">Everyone</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mt-2"><label className="text-xs text-ink-muted">Body</label><Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} /></div>
      <div className="mt-3 flex justify-end">
        <Button disabled={!title.trim() || !body.trim()} onClick={() => { if (confirm(`Send broadcast to "${audience}" audience?`)) onSend({ title, body, audience }); }}>Send</Button>
      </div>
    </div>
  );
}

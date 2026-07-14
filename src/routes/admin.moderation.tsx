import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import {
  listModerationTerms, upsertModerationTerm, deleteModerationTerm,
  listModRules, upsertModRule, listModerationEvents,
} from "@/lib/admin-moderation.functions";

export const Route = createFileRoute("/admin/moderation")({ component: ModerationPage });

function ModerationPage() {
  const qc = useQueryClient();
  const list = useServerFn(listModerationTerms);
  const up = useServerFn(upsertModerationTerm);
  const del = useServerFn(deleteModerationTerm);
  const rulesFn = useServerFn(listModRules);
  const ruleUp = useServerFn(upsertModRule);

  const terms = useQuery({ queryKey: ["mod", "terms"], queryFn: () => list() });
  const rules = useQuery({ queryKey: ["mod", "rules"], queryFn: () => rulesFn() });

  const [t, setT] = useState("");
  const [sev, setSev] = useState<"block" | "warn">("block");
  const [test, setTest] = useState("");

  const add = useMutation({
    mutationFn: () => up({ data: { term: t, severity: sev } }),
    onSuccess: () => { setT(""); toast.success("Term added"); qc.invalidateQueries({ queryKey: ["mod", "terms"] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });
  const rm = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mod", "terms"] }),
  });

  const norm = test
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/(.)\1{2,}/g, "$1$1");
  const matches = (terms.data ?? []).filter((row: any) => {
    const pat = row.term.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!pat) return false;
    return new RegExp(`\\b${pat}\\b`).test(norm);
  });

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 font-display text-xl text-ink">Moderation terms</h2>
        <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-surface p-4">
          <Input className="max-w-xs" value={t} onChange={(e) => setT(e.target.value)} placeholder="Term or phrase" />
          <Select value={sev} onValueChange={(v) => setSev(v as any)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="block">block</SelectItem>
              <SelectItem value="warn">warn</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => add.mutate()} disabled={!t.trim() || add.isPending}>Add</Button>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-ink-muted">
              <tr><th className="px-3 py-2 text-left">Term</th><th className="px-3 py-2 text-left">Severity</th><th className="px-3 py-2 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {(terms.data ?? []).map((row: any) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-3 py-1.5 font-mono text-xs">{row.term}</td>
                  <td className="px-3 py-1.5">{row.severity}</td>
                  <td className="px-3 py-1.5 text-right">
                    <Button size="sm" variant="ghost" onClick={() => rm.mutate(row.id)}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
          <h3 className="mb-2 font-display text-base text-ink">Test box</h3>
          <Textarea value={test} onChange={(e) => setTest(e.target.value)} placeholder="Paste text to test against your rules…" rows={3} />
          {test ? (
            <div className="mt-2 text-sm">
              {matches.length === 0 ? <span className="text-emerald-600">No matches.</span> : (
                <span className="text-rose-600">Matched: {matches.map((m: any) => m.term).join(", ")}</span>
              )}
            </div>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl text-ink">Auto-flag rules</h2>
        <p className="mb-3 text-sm text-ink-muted">Define guardrails. Evaluation hooks come in a follow-up — these rows are read by triggers/sweeps once wired.</p>
        <RuleEditor onCreate={(p) => ruleUp({ data: p }).then(() => { toast.success("Rule saved"); qc.invalidateQueries({ queryKey: ["mod", "rules"] }); })} />
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-ink-muted">
              <tr><th className="px-3 py-2 text-left">Key</th><th className="px-3 py-2 text-left">Action</th><th className="px-3 py-2 text-right">Threshold</th><th className="px-3 py-2 text-right">Window</th><th className="px-3 py-2 text-center">Enabled</th></tr>
            </thead>
            <tbody>
              {(rules.data ?? []).map((r: any) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-1.5 font-mono text-xs">{r.key}</td>
                  <td className="px-3 py-1.5">{r.action}</td>
                  <td className="px-3 py-1.5 text-right">{r.threshold ?? "—"}</td>
                  <td className="px-3 py-1.5 text-right">{r.window_seconds ?? "—"}s</td>
                  <td className="px-3 py-1.5 text-center">{r.enabled ? "✓" : "—"}</td>
                </tr>
              ))}
              {(rules.data ?? []).length === 0 ? <tr><td colSpan={5} className="px-3 py-4 text-center text-ink-muted">No rules yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function RuleEditor({ onCreate }: { onCreate: (p: any) => void }) {
  const [key, setKey] = useState("");
  const [action, setAction] = useState("auto_hide");
  const [thresh, setThresh] = useState<string>("3");
  const [win, setWin] = useState<string>("86400");
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-surface p-4">
      <div><label className="text-xs text-ink-muted">Key</label><Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="reports_threshold" /></div>
      <div><label className="text-xs text-ink-muted">Action</label>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="auto_hide">auto_hide</SelectItem>
            <SelectItem value="warn">warn</SelectItem>
            <SelectItem value="block">block</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div><label className="text-xs text-ink-muted">Threshold</label><Input className="w-24" value={thresh} onChange={(e) => setThresh(e.target.value)} /></div>
      <div><label className="text-xs text-ink-muted">Window (s)</label><Input className="w-28" value={win} onChange={(e) => setWin(e.target.value)} /></div>
      <Button disabled={!key.trim()} onClick={() => onCreate({ key: key.trim(), action, threshold: parseInt(thresh) || null, window_seconds: parseInt(win) || null, enabled: true })}>Save rule</Button>
    </div>
  );
}

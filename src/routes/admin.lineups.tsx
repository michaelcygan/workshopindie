import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { adminListLineupEvents, listLineupAudit, getLineupForEvent } from "@/lib/lineup.functions";

export const Route = createFileRoute("/admin/lineups")({
  component: AdminLineupsPage,
});

type LineupEvent = {
  id: string;
  slug: string;
  title: string;
  starts_at: string;
  status: string;
  lineup_mode: "open_claim" | "host_approval";
  group: { slug: string; name: string };
};

function AdminLineupsPage() {
  const listFn = useServerFn(adminListLineupEvents);
  const { data } = useQuery({ queryKey: ["admin-lineups"], queryFn: () => listFn() });
  const [selected, setSelected] = useState<string | null>(null);

  const rows = (data ?? []) as unknown as LineupEvent[];

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-2xl text-ink">Lineup events</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-3 py-2">Event</th>
                <th className="px-3 py-2">Starts</th>
                <th className="px-3 py-2">Mode</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={3} className="px-3 py-10 text-center text-ink-muted">No lineup events yet.</td></tr>
              )}
              {rows.map((e) => (
                <tr key={e.id} className={`cursor-pointer border-t border-border ${selected === e.id ? "bg-primary/5" : "hover:bg-muted/20"}`} onClick={() => setSelected(e.id)}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-ink">{e.title}</div>
                    <Link to="/g/$slug/e/$eventSlug" params={{ slug: e.group.slug, eventSlug: e.slug }} className="text-[11px] text-primary hover:underline">{e.group.name} →</Link>
                  </td>
                  <td className="px-3 py-2 text-ink-soft">{new Date(e.starts_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                  <td className="px-3 py-2 text-xs capitalize">{e.lineup_mode.replace("_", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4">
          {selected ? (
            <LineupAuditPanel eventId={selected} />
          ) : (
            <p className="text-sm text-ink-muted">Select a lineup event to audit.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function LineupAuditPanel({ eventId }: { eventId: string }) {
  const lineupFn = useServerFn(getLineupForEvent);
  const auditFn = useServerFn(listLineupAudit);
  const { data: lineup } = useQuery({ queryKey: ["admin-lineup", eventId], queryFn: () => lineupFn({ data: { event_id: eventId } }) });
  const { data: audit, refetch } = useQuery({ queryKey: ["admin-lineup-audit", eventId], queryFn: () => auditFn({ data: { event_id: eventId } }) });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg text-ink">Slots</h3>
        <Button size="sm" variant="ghost" className="h-7 rounded-full" onClick={() => refetch()}>Refresh</Button>
      </div>
      <ul className="mb-4 divide-y divide-border rounded-xl border border-border">
        {((lineup?.slots ?? []) as Array<{ id: string; position: number; status: string; stage_name: string | null; manual_performer_name: string | null; act_type: string | null }>).map((s) => (
          <li key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm">
            <span className="w-6 text-xs text-ink-muted">#{s.position}</span>
            <span className="flex-1 truncate">
              {s.stage_name || s.manual_performer_name || <span className="text-ink-muted">— open —</span>}
              {s.act_type && <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[9px] uppercase text-ink-soft">{s.act_type}</span>}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] capitalize">{s.status.replace("_", " ")}</span>
          </li>
        ))}
      </ul>

      <h3 className="mb-2 font-display text-lg text-ink">Audit log</h3>
      <ul className="max-h-[400px] space-y-1 overflow-y-auto rounded-xl border border-border p-2 text-xs">
        {((audit ?? []) as Array<{ id: string; action: string; actor_email: string | null; actor_user_id: string | null; created_at: string; metadata: Record<string, unknown> }>).map((a) => (
          <li key={a.id} className="flex items-start gap-2 border-b border-border/50 pb-1">
            <span className="w-28 shrink-0 text-ink-muted">{new Date(a.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
            <span className="w-20 shrink-0 font-medium capitalize">{a.action.replace("_", " ")}</span>
            <span className="truncate text-ink-soft">{a.actor_email ?? a.actor_user_id ?? "—"}</span>
          </li>
        ))}
        {(audit ?? []).length === 0 && (
          <li className="px-2 py-4 text-center text-ink-muted">No activity yet.</li>
        )}
      </ul>
    </div>
  );
}

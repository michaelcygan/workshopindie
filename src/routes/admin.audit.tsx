import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAuditLog } from "@/lib/admin-audit.functions";

export const Route = createFileRoute("/admin/audit")({ component: AuditLog });

function AuditLog() {
  const fn = useServerFn(listAuditLog);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "audit"], queryFn: () => fn({ data: { limit: 300 } }) });
  if (isLoading) return <div className="text-sm text-ink-muted">Loading…</div>;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-ink-muted">
          <tr>
            <th className="px-3 py-2 text-left">When</th>
            <th className="px-3 py-2 text-left">Actor</th>
            <th className="px-3 py-2 text-left">Action</th>
            <th className="px-3 py-2 text-left">Target</th>
            <th className="px-3 py-2 text-left">Payload</th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((r: any) => (
            <tr key={r.id} className="border-t border-border align-top">
              <td className="whitespace-nowrap px-3 py-1.5 text-xs text-ink-soft">{new Date(r.created_at).toLocaleString()}</td>
              <td className="px-3 py-1.5">
                {r.actor ? (
                  <Link to="/admin/users/$id" params={{ id: r.actor.id }} className="text-primary hover:underline">{r.actor.display_name || r.actor.username || r.actor.id.slice(0, 8)}</Link>
                ) : "—"}
              </td>
              <td className="px-3 py-1.5 font-mono text-xs">{r.action}</td>
              <td className="px-3 py-1.5 font-mono text-xs">{r.target_type ?? "—"}{r.target_id ? `:${r.target_id.slice(0, 8)}` : ""}</td>
              <td className="px-3 py-1.5 font-mono text-[11px] text-ink-muted">{JSON.stringify(r.payload)}</td>
            </tr>
          ))}
          {(data ?? []).length === 0 ? <tr><td colSpan={5} className="px-3 py-6 text-center text-ink-muted">No events yet.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

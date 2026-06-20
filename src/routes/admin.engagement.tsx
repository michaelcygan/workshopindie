import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminEngagement } from "@/lib/admin-analytics.functions";
import { KpiTile } from "@/components/admin/kpi-tile";
import { MetricChart } from "@/components/admin/metric-chart";

export const Route = createFileRoute("/admin/engagement")({ component: EngagementPage });

function EngagementPage() {
  const fn = useServerFn(getAdminEngagement);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "engagement"], queryFn: () => fn() });
  if (isLoading) return <div className="text-sm text-ink-muted">Loading…</div>;
  const k = data?.kpi as any;
  const stickiness = k?.mau ? Math.round((k.dau / k.mau) * 100) : 0;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile label="DAU" value={(k?.dau ?? 0).toLocaleString()} />
        <KpiTile label="WAU" value={(k?.wau ?? 0).toLocaleString()} />
        <KpiTile label="MAU" value={(k?.mau ?? 0).toLocaleString()} />
        <KpiTile label="DAU/MAU" value={`${stickiness}%`} tone={stickiness >= 20 ? "good" : "warn"} sublabel="Stickiness" />
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <h3 className="mb-2 font-display text-lg text-ink">DAU (90d)</h3>
        <MetricChart data={(data?.dau ?? []) as any} xKey="day" yKey="dau" />
      </div>

      <div>
        <h3 className="mb-3 font-display text-lg text-ink">Surface usage (7d)</h3>
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-3 py-2 text-left">Surface</th>
                <th className="px-3 py-2 text-right">Active users</th>
                <th className="px-3 py-2 text-right">Actions</th>
                <th className="px-3 py-2 text-right">Per active</th>
                <th className="px-3 py-2 text-right">% of WAU</th>
              </tr>
            </thead>
            <tbody>
              {(data?.surfaces ?? []).map((s: any) => (
                <tr key={s.surface} className="border-t border-border">
                  <td className="px-3 py-2 text-ink">{s.surface}</td>
                  <td className="px-3 py-2 text-right">{s.active_users.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">{s.actions.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">{s.active_users > 0 ? (s.actions / s.active_users).toFixed(2) : "—"}</td>
                  <td className="px-3 py-2 text-right">{k?.wau ? `${Math.round((s.active_users / k.wau) * 100)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminRevenue } from "@/lib/admin-analytics.functions";
import { KpiTile } from "@/components/admin/kpi-tile";
import { MetricChart } from "@/components/admin/metric-chart";

export const Route = createFileRoute("/admin/revenue")({ component: RevenuePage });

function RevenuePage() {
  const fn = useServerFn(getAdminRevenue);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "revenue"], queryFn: () => fn() });
  if (isLoading) return <div className="text-sm text-ink-muted">Loading…</div>;

  const counts = (data?.statusCounts ?? []) as any[];
  const liveActive = counts.filter((r) => r.environment === "live" && r.tier === "plus" && (r.status === "active" || r.status === "trialing")).reduce((a, r) => a + r.n, 0);
  const livePastDue = counts.filter((r) => r.environment === "live" && r.status === "past_due").reduce((a, r) => a + r.n, 0);
  const liveCanceled = counts.filter((r) => r.environment === "live" && r.status === "canceled").reduce((a, r) => a + r.n, 0);
  const sandboxActive = counts.filter((r) => r.environment === "sandbox" && r.tier === "plus" && (r.status === "active" || r.status === "trialing")).reduce((a, r) => a + r.n, 0);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 font-display text-xl text-ink">Subscriptions (live)</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <KpiTile label="Active Plus" value={liveActive} tone="good" />
          <KpiTile label="Past due" value={livePastDue} tone={livePastDue ? "warn" : "default"} />
          <KpiTile label="Canceled" value={liveCanceled} />
          <KpiTile label="Sandbox Plus" value={sandboxActive} sublabel="Test env only" />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <h3 className="mb-2 font-display text-lg text-ink">Active Plus subs by week (12w, live)</h3>
        <MetricChart data={(data?.mrr ?? []) as any} xKey="week" yKey="active_subs" kind="bar" />
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl text-ink">Failed payments queue</h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-3 py-2 text-left">User</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Tier</th>
                <th className="px-3 py-2 text-left">Period end</th>
                <th className="px-3 py-2 text-left">Env</th>
              </tr>
            </thead>
            <tbody>
              {(data?.failed ?? []).map((r: any) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-1.5">
                    <Link to="/admin/users/$id" params={{ id: r.user_id }} className="text-primary hover:underline">
                      {r.display_name || r.username || r.user_id?.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-3 py-1.5">{r.status}</td>
                  <td className="px-3 py-1.5">{r.tier}</td>
                  <td className="px-3 py-1.5">{r.current_period_end ? new Date(r.current_period_end).toLocaleDateString() : "—"}</td>
                  <td className="px-3 py-1.5">{r.environment}</td>
                </tr>
              ))}
              {(data?.failed ?? []).length === 0 ? (
                <tr><td className="px-3 py-4 text-center text-ink-muted" colSpan={5}>No failed payments. ✨</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl text-ink">Recent subscriptions</h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-3 py-2 text-left">User</th>
                <th className="px-3 py-2 text-left">Tier</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Env</th>
                <th className="px-3 py-2 text-left">Created</th>
                <th className="px-3 py-2 text-left">Period end</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recent ?? []).map((r: any) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-1.5">
                    <Link to="/admin/users/$id" params={{ id: r.user_id }} className="text-primary hover:underline">{r.user_id?.slice(0, 8)}</Link>
                  </td>
                  <td className="px-3 py-1.5">{r.tier}</td>
                  <td className="px-3 py-1.5">{r.status}</td>
                  <td className="px-3 py-1.5">{r.environment}</td>
                  <td className="px-3 py-1.5">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-1.5">{r.current_period_end ? new Date(r.current_period_end).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

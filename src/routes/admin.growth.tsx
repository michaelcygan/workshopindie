import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminGrowth } from "@/lib/admin-analytics.functions";
import { MetricChart } from "@/components/admin/metric-chart";
import { CohortHeatmap } from "@/components/admin/cohort-heatmap";
import { FunnelChart } from "@/components/admin/funnel";

export const Route = createFileRoute("/admin/growth")({ component: GrowthPage });

function GrowthPage() {
  const fn = useServerFn(getAdminGrowth);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "growth"], queryFn: () => fn() });
  if (isLoading) return <div className="text-sm text-ink-muted">Loading…</div>;
  const f = data?.funnel as any;
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-4 font-display text-lg text-ink">Acquisition funnel (90d)</h2>
        <FunnelChart
          steps={[
            { label: "Share clicks", value: f?.share_clicks ?? 0 },
            { label: "Signups", value: f?.signups ?? 0 },
            { label: "Onboarded", value: f?.onboarded ?? 0 },
            { label: "First action", value: f?.first_action ?? 0 },
            { label: "Retained day-7", value: f?.retained_d7 ?? 0 },
          ]}
        />
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-2 font-display text-lg text-ink">Daily signups (365d)</h2>
        <MetricChart data={(data?.signups ?? []) as any} xKey="day" yKey="signups" />
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg text-ink">Signup cohort retention (12 weeks)</h2>
        <CohortHeatmap rows={(data?.cohorts ?? []) as any} />
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg text-ink">Top referrers</h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-3 py-2 text-left">User</th>
                <th className="px-3 py-2 text-right">Signups</th>
                <th className="px-3 py-2 text-right">Paid conversions</th>
              </tr>
            </thead>
            <tbody>
              {(data?.referrals ?? []).slice(0, 50).map((r: any) => (
                <tr key={r.user_id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <Link to="/admin/users/$id" params={{ id: r.user_id }} className="text-primary hover:underline">
                      {r.display_name || r.username || r.user_id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right">{r.signups}</td>
                  <td className="px-3 py-2 text-right">{r.paid_conversions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

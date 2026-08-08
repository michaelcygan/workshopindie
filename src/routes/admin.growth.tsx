import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminGrowth } from "@/lib/admin-analytics.functions";
import { MetricChart } from "@/components/admin/metric-chart";
import { CohortHeatmap } from "@/components/admin/cohort-heatmap";
import { FunnelChart } from "@/components/admin/funnel";
import { Metric, RatioMetric, SectionHeading, UpdatedAt, Unavailable } from "@/components/admin/metric";
import { NarrativeList } from "@/components/admin/narrative-list";
import { METRIC_DEFINITIONS, fmtNumber } from "@/lib/analytics";
import { isOk, rows } from "@/lib/analytics/envelope";
import { retentionNarrative } from "@/lib/analytics/narrative";
import { TrackingLinkAnalytics } from "@/components/admin/tracking-link-analytics";

export const Route = createFileRoute("/admin/growth")({ component: GrowthPage });

function GrowthPage() {
  const fn = useServerFn(getAdminGrowth);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "growth"], queryFn: () => fn(), refetchOnWindowFocus: false });
  if (isLoading) return <div className="text-sm text-ink-muted">Loading…</div>;

  const kpi = isOk(data?.kpi) ? (data!.kpi.data as any) : null;
  const f = isOk(data?.funnel) ? (data!.funnel.data as any) : null;
  const growth = rows<any>(data?.growth);
  const cohorts = rows<any>(data?.cohorts);
  const retention = rows<any>(data?.retention);
  const referrals = rows<any>(data?.referrals);
  const byWindow = (n: number) => retention.find((r) => r.window_days === n);

  return (
    <div className="space-y-10">
      <section>
        <SectionHeading title="Growth" hint="Who is joining, and do they come back?" right={<UpdatedAt at={data?.fetchedAt} />} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Metric label="Members" value={kpi?.members_total ?? null} status={data?.kpi.status} definition={METRIC_DEFINITIONS.members_total.definition} />
          <Metric label="New 30d" value={kpi?.signups_30d ?? null} prior={kpi?.signups_prev_30d} status={data?.kpi.status} />
          <Metric label="New 7d" value={kpi?.signups_7d ?? null} prior={kpi?.signups_prev_7d} periodLabel="prior 7d" status={data?.kpi.status} />
          <RatioMetric label="Onboarded" numerator={kpi?.onboarded_total} denominator={kpi?.members_total} status={data?.kpi.status} definition={METRIC_DEFINITIONS.onboarded.definition} />
          <RatioMetric label="Activated (all time)" numerator={kpi?.activated_total} denominator={kpi?.members_total} status={data?.kpi.status} definition={METRIC_DEFINITIONS.activated.definition} />
          <RatioMetric label="Activated (30d cohort)" numerator={kpi?.cohort_30d_activated} denominator={kpi?.cohort_30d} status={data?.kpi.status} definition={METRIC_DEFINITIONS.activated.definition} />
        </div>
      </section>

      <section>
        <SectionHeading title="Retention" hint="Denominator is only members old enough for the window." />
        <div className="grid grid-cols-3 gap-3">
          {[1, 7, 30].map((w) => {
            const r = byWindow(w);
            return (
              <RatioMetric
                key={w}
                label={`D${w} retained`}
                numerator={r?.retained}
                denominator={r?.eligible}
                status={data?.retention.status}
                definition={METRIC_DEFINITIONS[`d${w}` as "d1"].definition}
              />
            );
          })}
        </div>
        <div className="mt-3">
          <NarrativeList items={retentionNarrative(retention)} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-4 font-display text-lg text-ink">Acquisition funnel (90d)</h2>
        {data?.funnel.status === "unavailable" ? (
          <Unavailable />
        ) : (
          <>
            <FunnelChart
              steps={[
                { label: "Share-link visits", value: f?.share_clicks ?? 0 },
                { label: "Signups", value: f?.signups ?? 0 },
                { label: "Onboarded", value: f?.onboarded ?? 0 },
                { label: "First creative action", value: f?.first_action ?? 0 },
                { label: "Still active at day 7", value: f?.retained_d7 ?? 0 },
              ]}
            />
            <p className="mt-3 text-xs text-ink-muted">
              {METRIC_DEFINITIONS.share_visits.definition} Steps below signup are not strictly sequential per person.
            </p>
          </>
        )}
      </section>

      <TrackingLinkAnalytics />

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-2 font-display text-lg text-ink">Daily signups</h2>
        {data?.growth.status === "unavailable" ? <Unavailable /> : <MetricChart data={growth as any} xKey="day" yKey="signups" kind="bar" />}
      </section>

      <section>
        <SectionHeading title="Signup cohorts" hint="Each row is a signup week; each cell is the share still taking action that week." />
        {data?.cohorts.status === "unavailable" ? (
          <div className="rounded-2xl border border-border bg-surface p-6 text-center"><Unavailable /></div>
        ) : cohorts.length ? (
          <CohortHeatmap rows={cohorts as any} />
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-ink-muted">
            Not enough signup history to build cohorts yet.
          </div>
        )}
      </section>

      <section>
        <SectionHeading title="Top referrers" />
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-3 py-2 text-left">Member</th>
                <th className="px-3 py-2 text-right">Signups</th>
                <th className="px-3 py-2 text-right">Paid conversions</th>
              </tr>
            </thead>
            <tbody>
              {referrals.slice(0, 50).map((r: any) => (
                <tr key={r.user_id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <Link to="/admin/users/$id" params={{ id: r.user_id }} className="text-primary hover:underline">
                      {r.display_name || r.username || r.user_id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right">{fmtNumber(r.signups)}</td>
                  <td className="px-3 py-2 text-right">{fmtNumber(r.paid_conversions)}</td>
                </tr>
              ))}
              {!referrals.length ? (
                <tr><td colSpan={3} className="px-3 py-6 text-center text-ink-muted">No referrals recorded yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

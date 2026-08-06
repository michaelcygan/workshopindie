import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminPulse } from "@/lib/admin-analytics.functions";
import { Metric, RatioMetric, SectionHeading, UpdatedAt, Unavailable } from "@/components/admin/metric";
import { MetricChart } from "@/components/admin/metric-chart";
import { NarrativeList } from "@/components/admin/narrative-list";
import { SurfaceTable } from "@/components/admin/surface-table";
import { METRIC_DEFINITIONS, PLUS_MONTHLY_PRICE_USD, fmtNumber, fmtUsd } from "@/lib/analytics";
import { isOk, rows } from "@/lib/analytics/envelope";
import { pulseNarrative } from "@/lib/analytics/narrative";
import { DataHealth } from "@/components/admin/data-health";

export const Route = createFileRoute("/admin/")({ component: Pulse });

function Pulse() {
  const fn = useServerFn(getAdminPulse);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "pulse"], queryFn: () => fn(), refetchOnWindowFocus: false });

  if (isLoading) return <div className="text-sm text-ink-muted">Loading…</div>;

  const kpi = isOk(data?.kpi) ? (data!.kpi.data as any) : null;
  const revenue = isOk(data?.revenue) ? (data!.revenue.data as any) : null;
  const cities = rows<any>(data?.cities);
  const growth = rows<any>(data?.growth);
  const daily = rows<any>(data?.daily);
  const surfaces = rows<any>(data?.surfaces);
  const retention = rows<any>(data?.retention);
  const mrr = revenue ? (revenue.live_active_paid ?? 0) * PLUS_MONTHLY_PRICE_USD : null;
  const d7 = retention.find((r) => r.window_days === 7);

  return (
    <div className="space-y-10">
      <section>
        <SectionHeading
          title="Company pulse"
          hint="Everything below is trailing 30 days unless labelled otherwise."
          right={<UpdatedAt at={kpi?.computed_at ?? data?.fetchedAt} />}
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <Metric
            label="Members"
            value={kpi?.members_total ?? null}
            status={data?.kpi.status}
            definition={METRIC_DEFINITIONS.members_total.definition}
            size="lg"
          />
          <Metric
            label="New members 30d"
            value={kpi?.signups_30d ?? null}
            prior={kpi?.signups_prev_30d}
            status={data?.kpi.status}
            definition={METRIC_DEFINITIONS.signup.definition}
          />
          <Metric
            label="Weekly active creators"
            value={kpi?.wac ?? null}
            prior={kpi?.wac_prev}
            periodLabel="prior 7d"
            status={data?.kpi.status}
            definition={METRIC_DEFINITIONS.wac.definition}
          />
          <Metric
            label="MAU"
            value={kpi?.mau ?? null}
            prior={kpi?.mau_prev}
            sublabel={kpi ? `${fmtNumber(kpi.mac)} of them created` : undefined}
            status={data?.kpi.status}
            definition={METRIC_DEFINITIONS.mau.definition}
          />
          <RatioMetric
            label="Activation (30d cohort)"
            numerator={kpi?.cohort_30d_activated}
            denominator={kpi?.cohort_30d}
            status={data?.kpi.status}
            definition={METRIC_DEFINITIONS.activated.definition}
          />
          <Metric
            label="MRR"
            value={mrr === null ? null : fmtUsd(mrr)}
            sublabel={revenue ? `${fmtNumber(revenue.live_active_paid)} paying · ${fmtNumber(revenue.live_trialing)} trialing` : undefined}
            status={data?.revenue.status}
            definition={METRIC_DEFINITIONS.mrr.definition}
          />
        </div>
      </section>

      <section>
        <SectionHeading title="The read" hint="Plain-language restatement of the numbers above. No estimates." />
        <NarrativeList items={pulseNarrative(kpi, revenue, cities)} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <h3 className="mb-2 font-display text-lg text-ink">Members over time</h3>
          {data?.growth.status === "unavailable" ? (
            <Unavailable />
          ) : (
            <MetricChart data={growth as any} xKey="day" yKey="members_cumulative" />
          )}
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <h3 className="mb-2 font-display text-lg text-ink">Daily active members</h3>
          {data?.daily.status === "unavailable" ? (
            <Unavailable />
          ) : (
            <MetricChart data={daily as any} xKey="day" yKey="active_users" color="hsl(var(--accent))" />
          )}
        </div>
      </section>

      <section>
        <SectionHeading
          title="Where the work happens"
          hint="Members and actions per surface, last 30 days."
          right={<Link to="/admin/engagement" className="text-sm text-primary hover:underline">Product detail →</Link>}
        />
        <SurfaceTable rows={surfaces} unavailable={data?.surfaces.status === "unavailable"} />
      </section>

      <section>
        <SectionHeading
          title="Needs attention"
          right={<Link to="/admin/reports" className="text-sm text-primary hover:underline">Reports →</Link>}
        />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="Open reports" value={kpi?.open_reports ?? null} status={data?.kpi.status} />
          <Metric label="Past due subscriptions" value={revenue?.live_past_due ?? null} status={data?.revenue.status} />
          <RatioMetric
            label="D7 retention"
            numerator={d7?.retained}
            denominator={d7?.eligible}
            status={data?.retention.status}
            definition={METRIC_DEFINITIONS.d7.definition}
          />
          <Metric
            label="Cities with members"
            value={cities.filter((c) => c.members > 0).length}
            status={data?.cities.status}
            sublabel={`${cities.filter((c) => (c.mau ?? 0) > 0).length} active in 30d`}
          />
        </div>
      </section>

      <section>
        <DataHealth compact />
      </section>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getInvestorSnapshot } from "@/lib/admin-analytics.functions";
import { MetricChart } from "@/components/admin/metric-chart";
import { CohortHeatmap } from "@/components/admin/cohort-heatmap";
import { Metric, RatioMetric, SectionHeading, UpdatedAt } from "@/components/admin/metric";
import { NarrativeList } from "@/components/admin/narrative-list";
import { METRIC_DEFINITIONS, PLUS_MONTHLY_PRICE_USD, fmtNumber, fmtUsd } from "@/lib/analytics";
import { isOk, rows } from "@/lib/analytics/envelope";
import { pulseNarrative } from "@/lib/analytics/narrative";

export const Route = createFileRoute("/admin/investor")({ component: InvestorView });

/**
 * Investor View: aggregate only. No names, no emails, no per-member rows.
 * Every number here is the same view the operator dashboard reads.
 */
function InvestorView() {
  const fn = useServerFn(getInvestorSnapshot);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "investor"], queryFn: () => fn(), refetchOnWindowFocus: false });
  if (isLoading) return <div className="text-sm text-ink-muted">Loading…</div>;

  const kpi = isOk(data?.kpi) ? (data!.kpi.data as any) : null;
  const revenue = isOk(data?.revenue) ? (data!.revenue.data as any) : null;
  const growth = rows<any>(data?.growth);
  const cohorts = rows<any>(data?.cohorts);
  const retention = rows<any>(data?.retention);
  const surfaces = rows<any>(data?.surfaces).filter((s) => s.surface !== "presence");
  const cities = rows<any>(data?.cities).filter((c) => c.members > 0);
  const countries = rows<any>(data?.countries).filter((c) => c.members > 0);
  const mrr = revenue ? (revenue.live_active_paid ?? 0) * PLUS_MONTHLY_PRICE_USD : null;
  const d30 = retention.find((r) => r.window_days === 30);

  return (
    <div className="space-y-10 print:space-y-6">
      <section>
        <SectionHeading
          title="Workshop — company snapshot"
          hint="Aggregate metrics only. No personal data is shown on this page."
          right={
            <div className="flex items-center gap-3">
              <UpdatedAt at={kpi?.computed_at ?? data?.fetchedAt} />
              <button type="button" onClick={() => window.print()} className="rounded-full border border-border px-3 py-1 text-sm text-ink-soft print:hidden">
                Print
              </button>
            </div>
          }
        />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Metric label="Members" value={kpi?.members_total ?? null} status={data?.kpi.status} size="lg" />
          <Metric label="New members 30d" value={kpi?.signups_30d ?? null} prior={kpi?.signups_prev_30d} status={data?.kpi.status} />
          <Metric label="Weekly active creators" value={kpi?.wac ?? null} prior={kpi?.wac_prev} periodLabel="prior 7d" status={data?.kpi.status} definition={METRIC_DEFINITIONS.wac.definition} />
          <Metric label="MAU" value={kpi?.mau ?? null} prior={kpi?.mau_prev} status={data?.kpi.status} />
          <RatioMetric label="Activation" numerator={kpi?.cohort_30d_activated} denominator={kpi?.cohort_30d} status={data?.kpi.status} definition={METRIC_DEFINITIONS.activated.definition} />
          <Metric label="MRR" value={mrr === null ? null : fmtUsd(mrr)} status={data?.revenue.status} definition={METRIC_DEFINITIONS.mrr.definition} />
        </div>
      </section>

      <section>
        <SectionHeading title="What the numbers say" />
        <NarrativeList items={pulseNarrative(kpi, revenue, cities)} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <h3 className="mb-2 font-display text-lg text-ink">Membership growth</h3>
          <MetricChart data={growth as any} xKey="day" yKey="members_cumulative" />
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <h3 className="mb-2 font-display text-lg text-ink">Creative output, 30 days</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink">
            <li>Works published: {fmtNumber(kpi?.works_30d)}</li>
            <li>Collabs posted: {fmtNumber(kpi?.collabs_30d)}</li>
            <li>Collab applications: {fmtNumber(kpi?.applications_30d)}</li>
            <li>Events created: {fmtNumber(kpi?.events_30d)}</li>
            <li>Event RSVPs: {fmtNumber(kpi?.rsvps_30d)}</li>
            <li>Blog posts: {fmtNumber(kpi?.blog_30d)}</li>
          </ul>
        </div>
      </section>

      <section>
        <SectionHeading title="Retention" hint="Members are only counted once their account is old enough for the window." />
        <div className="grid grid-cols-3 gap-3">
          {[1, 7, 30].map((w) => {
            const r = retention.find((x) => x.window_days === w);
            return <RatioMetric key={w} label={`D${w}`} numerator={r?.retained} denominator={r?.eligible} status={data?.retention.status} />;
          })}
        </div>
        {cohorts.length ? (
          <div className="mt-4">
            <CohortHeatmap rows={cohorts as any} />
          </div>
        ) : null}
      </section>

      <section>
        <SectionHeading title="Engagement mix" hint="Members active per surface, last 30 days." />
        <div className="grid gap-2 md:grid-cols-2">
          {surfaces
            .slice()
            .sort((a, b) => b.active_users - a.active_users)
            .slice(0, 8)
            .map((s) => (
              <div key={s.surface} className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2 text-sm">
                <span className="text-ink">{s.surface}</span>
                <span className="text-ink-soft">{fmtNumber(s.active_users)} members · {fmtNumber(s.actions)} actions</span>
              </div>
            ))}
        </div>
      </section>

      <section>
        <SectionHeading title="Geography" hint={`${fmtNumber(cities.length)} cities across ${fmtNumber(countries.length)} countries.`} />
        <div className="grid gap-2 md:grid-cols-2">
          {cities.slice(0, 10).map((c) => (
            <div key={c.city_id} className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2 text-sm">
              <span className="text-ink">{c.name}{c.country ? `, ${c.country}` : ""}</span>
              <span className="text-ink-soft">{fmtNumber(c.members)} members · {fmtNumber(c.mau)} active</span>
            </div>
          ))}
        </div>
      </section>

      <p className="text-xs text-ink-muted">
        Definitions: {METRIC_DEFINITIONS.wac.term} — {METRIC_DEFINITIONS.wac.definition} {METRIC_DEFINITIONS.mrr.term} — {METRIC_DEFINITIONS.mrr.definition}
        {d30 && d30.eligible < 5 ? " Retention samples are still small; counts are shown alongside percentages." : ""}
      </p>
    </div>
  );
}

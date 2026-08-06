import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminRevenue } from "@/lib/admin-analytics.functions";
import { MetricChart } from "@/components/admin/metric-chart";
import { Metric, RatioMetric, SectionHeading, UpdatedAt, Unavailable } from "@/components/admin/metric";
import { METRIC_DEFINITIONS, PLUS_MONTHLY_PRICE_USD, fmtNumber, fmtUsd } from "@/lib/analytics";
import { isOk, rows } from "@/lib/analytics/envelope";

export const Route = createFileRoute("/admin/revenue")({ component: RevenuePage });

function RevenuePage() {
  const fn = useServerFn(getAdminRevenue);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "revenue"], queryFn: () => fn(), refetchOnWindowFocus: false });
  if (isLoading) return <div className="text-sm text-ink-muted">Loading…</div>;

  const now = isOk(data?.now) ? (data!.now.data as any) : null;
  const series = rows<any>(data?.series);
  const failed = rows<any>(data?.failed);
  const recent = rows<any>(data?.recent);
  const mrr = now ? (now.live_active_paid ?? 0) * PLUS_MONTHLY_PRICE_USD : null;

  return (
    <div className="space-y-10">
      <section>
        <SectionHeading
          title="Revenue"
          hint={`Live environment only. Plus is $${PLUS_MONTHLY_PRICE_USD.toFixed(2)}/mo; trials are excluded from MRR.`}
          right={<UpdatedAt at={data?.fetchedAt} />}
        />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Metric label="MRR" value={mrr === null ? null : fmtUsd(mrr)} status={data?.now.status} definition={METRIC_DEFINITIONS.mrr.definition} size="lg" />
          <Metric label="ARR run rate" value={mrr === null ? null : fmtUsd(mrr * 12)} status={data?.now.status} definition={METRIC_DEFINITIONS.arr_run_rate.definition} />
          <Metric label="Paying members" value={now?.live_active_paid ?? null} status={data?.now.status} definition={METRIC_DEFINITIONS.active_plus.definition} />
          <Metric label="On trial" value={now?.live_trialing ?? null} status={data?.now.status} sublabel="Not counted in MRR" />
          <Metric label="New paid 30d" value={now?.new_paid_30d ?? null} prior={now?.new_paid_prev_30d} status={data?.now.status} />
          <RatioMetric label="Free → Plus" numerator={now?.live_active_paid} denominator={now?.eligible_members} status={data?.now.status} definition={METRIC_DEFINITIONS.conversion.definition} />
        </div>
        <p className="mt-3 text-xs text-ink-muted">
          Churn: {METRIC_DEFINITIONS.churn.definition}
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <h3 className="mb-2 font-display text-lg text-ink">Paying members by week</h3>
        {data?.series.status === "unavailable" ? <Unavailable /> : <MetricChart data={series as any} xKey="week" yKey="active_subs" kind="bar" />}
      </section>

      <section>
        <SectionHeading title="Needs attention" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="Past due" value={now?.live_past_due ?? null} status={data?.now.status} />
          <Metric label="Canceled (all time)" value={now?.live_canceled_total ?? null} status={data?.now.status} />
          <Metric label="Sandbox Plus" value={now?.sandbox_plus ?? null} status={data?.now.status} sublabel="Test env, excluded everywhere" />
        </div>
        {failed.length ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="border-b border-border bg-muted/50 px-3 py-2 text-xs uppercase tracking-wide text-ink-muted">Failed payments</div>
            <table className="w-full text-sm">
              <tbody>
                {failed.map((r: any) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <Link to="/admin/users/$id" params={{ id: r.user_id }} className="text-primary hover:underline">
                        {r.display_name || r.username || r.user_id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-ink-soft">{r.status}</td>
                    <td className="px-3 py-2 text-right text-ink-soft">
                      {r.current_period_end ? new Date(r.current_period_end).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section>
        <SectionHeading title="Recent subscriptions" hint={`${fmtNumber(recent.length)} most recent records, all environments.`} />
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-3 py-2 text-left">Member</th>
                <th className="px-3 py-2 text-left">Tier</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Env</th>
                <th className="px-3 py-2 text-left">Renews</th>
                <th className="px-3 py-2 text-left">Started</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((s: any) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <Link to="/admin/users/$id" params={{ id: s.user_id }} className="text-primary hover:underline">
                      {s.user_id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{s.tier}</td>
                  <td className="px-3 py-2">{s.status}</td>
                  <td className="px-3 py-2 text-ink-soft">{s.environment}</td>
                  <td className="px-3 py-2 text-ink-soft">{s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "—"}</td>
                  <td className="px-3 py-2 text-ink-soft">{new Date(s.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {!recent.length ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-ink-muted">No subscriptions yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

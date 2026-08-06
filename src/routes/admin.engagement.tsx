import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminEngagement, getAdminLoungeAudio } from "@/lib/admin-analytics.functions";
import { MetricChart } from "@/components/admin/metric-chart";
import { Metric, RatioMetric, SectionHeading, UpdatedAt, Unavailable } from "@/components/admin/metric";
import { SurfaceTable } from "@/components/admin/surface-table";
import { NarrativeList } from "@/components/admin/narrative-list";
import { METRIC_DEFINITIONS } from "@/lib/analytics";
import { isOk, rows } from "@/lib/analytics/envelope";
import { surfaceNarrative } from "@/lib/analytics/narrative";

export const Route = createFileRoute("/admin/engagement")({ component: EngagementPage });

function EngagementPage() {
  const fn = useServerFn(getAdminEngagement);
  const loungeFn = useServerFn(getAdminLoungeAudio);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "engagement"], queryFn: () => fn(), refetchOnWindowFocus: false });
  const { data: lounge, isLoading: loungeLoading } = useQuery({ queryKey: ["admin", "lounge-audio"], queryFn: () => loungeFn() });
  if (isLoading) return <div className="text-sm text-ink-muted">Loading…</div>;

  const kpi = isOk(data?.kpi) ? (data!.kpi.data as any) : null;
  const surfaces = rows<any>(data?.surfaces);
  const daily = rows<any>(data?.daily);
  const weekly = rows<any>(data?.weekly);
  const t = lounge?.totals as any;

  return (
    <div className="space-y-10">
      <section>
        <SectionHeading title="Product" hint="What members actually do, last 30 days." right={<UpdatedAt at={kpi?.computed_at ?? data?.fetchedAt} />} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Metric label="DAU" value={kpi?.dau ?? null} status={data?.kpi.status} definition={METRIC_DEFINITIONS.dau.definition} />
          <Metric label="WAU" value={kpi?.wau ?? null} prior={kpi?.wau_prev} periodLabel="prior 7d" status={data?.kpi.status} definition={METRIC_DEFINITIONS.wau.definition} />
          <Metric label="MAU" value={kpi?.mau ?? null} prior={kpi?.mau_prev} status={data?.kpi.status} definition={METRIC_DEFINITIONS.mau.definition} />
          <Metric label="Weekly active creators" value={kpi?.wac ?? null} prior={kpi?.wac_prev} periodLabel="prior 7d" status={data?.kpi.status} definition={METRIC_DEFINITIONS.wac.definition} />
          <RatioMetric label="Creators share of MAU" numerator={kpi?.mac} denominator={kpi?.mau} status={data?.kpi.status} definition="Members who did something creative in 30 days, over all members active in 30 days." />
        </div>
      </section>

      <section>
        <SectionHeading title="The read" />
        <NarrativeList items={surfaceNarrative(surfaces)} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <h3 className="mb-2 font-display text-lg text-ink">Daily actives</h3>
          {data?.daily.status === "unavailable" ? <Unavailable /> : <MetricChart data={daily as any} xKey="day" yKey="active_users" />}
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <h3 className="mb-2 font-display text-lg text-ink">Weekly active creators</h3>
          {data?.weekly.status === "unavailable" ? <Unavailable /> : <MetricChart data={weekly as any} xKey="week" yKey="active_creators" kind="bar" color="hsl(var(--accent))" />}
        </div>
      </section>

      <section>
        <SectionHeading title="Surfaces" hint="Members, actions and returning members per surface, last 30 days." />
        <SurfaceTable rows={surfaces} unavailable={data?.surfaces.status === "unavailable"} denominator={kpi?.mau ?? null} />
      </section>

      <section>
        <SectionHeading title="Lounge audio" hint="Session quality signals for live audio." />
        {loungeLoading ? (
          <div className="text-sm text-ink-muted">Loading…</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <Metric label="Connected minutes" value={t?.minutes ?? 0} />
              <Metric label="Mic grabs" value={t?.mic_grabs ?? 0} />
              <Metric label="Speaker joins" value={t?.speaker_joins ?? 0} />
              <Metric label="Queue abandons" value={t?.queue_abandons ?? 0} />
              <Metric label="Reconnects" value={t?.reconnects ?? 0} />
              <Metric label="Mic denials" value={t?.mic_denials ?? 0} />
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4">
              <h4 className="mb-2 text-sm font-medium text-ink">Connected minutes per day</h4>
              <MetricChart data={(lounge?.daily ?? []) as any} xKey="day" yKey="minutes" kind="bar" />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

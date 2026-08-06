import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminMarketplace } from "@/lib/admin-analytics.functions";
import { FunnelChart } from "@/components/admin/funnel";
import { Metric, RatioMetric, SectionHeading, UpdatedAt } from "@/components/admin/metric";
import { METRIC_DEFINITIONS } from "@/lib/analytics";
import { isOk } from "@/lib/analytics/envelope";

export const Route = createFileRoute("/admin/marketplace")({ component: MarketplacePage });

function MarketplacePage() {
  const fn = useServerFn(getAdminMarketplace);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "marketplace"], queryFn: () => fn(), refetchOnWindowFocus: false });
  if (isLoading) return <div className="text-sm text-ink-muted">Loading…</div>;

  const c = isOk(data?.collabFunnel) ? (data!.collabFunnel.data as any) : null;
  const w = isOk(data?.loungeFunnel) ? (data!.loungeFunnel.data as any) : null;
  const wk = isOk(data?.worksFunnel) ? (data!.worksFunnel.data as any) : null;
  const h = isOk(data?.health) ? (data!.health.data as any) : null;
  const ch = isOk(data?.collabHealth) ? (data!.collabHealth.data as any) : null;

  return (
    <div className="space-y-10">
      <section>
        <SectionHeading title="Collabs" hint="Does posting a collab reliably get a response?" right={<UpdatedAt at={data?.fetchedAt} />} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Metric label="Posted 30d" value={ch?.posts_30d ?? c?.posts_30d ?? null} prior={ch?.posts_prev_30d} status={data?.collabHealth.status} />
          <Metric label="Open now" value={c?.open_now ?? null} status={data?.collabFunnel.status} />
          <Metric label="Applications 30d" value={ch?.applications_30d ?? null} prior={ch?.applications_prev_30d} status={data?.collabHealth.status} definition={METRIC_DEFINITIONS.collab_application.definition} />
          <Metric label="Unique applicants 30d" value={ch?.unique_applicants_30d ?? null} status={data?.collabHealth.status} />
          <RatioMetric label="Posts that got a reply" numerator={ch?.posts_with_application_30d} denominator={ch?.posts_30d} status={data?.collabHealth.status} definition="Collabs posted in the last 30 days that received at least one application." />
          <RatioMetric label="Applications reviewed" numerator={ch?.applications_reviewed_30d} denominator={ch?.applications_30d} status={data?.collabHealth.status} definition="Applications the poster moved out of the 'new' state." />
        </div>
        <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
          <h3 className="mb-3 font-display text-base text-ink">Collab funnel (30d)</h3>
          <FunnelChart
            steps={[
              { label: "Posts created", value: ch?.posts_30d ?? 0 },
              { label: "Applications", value: (ch?.applications_30d ?? 0) + (ch?.guest_applications_30d ?? 0) },
              { label: "Reviewed by poster", value: ch?.applications_reviewed_30d ?? 0 },
              { label: "→ Work published (90d)", value: c?.converted_to_work_90d ?? 0 },
            ]}
          />
        </div>
      </section>

      <section>
        <SectionHeading title="Marketplace health" />
        <div className="grid gap-3 md:grid-cols-3">
          <Metric label="Time to first application" value={h?.avg_time_to_first_app_hours != null ? `${h.avg_time_to_first_app_hours}h` : null} status={data?.health.status} />
          <Metric label="Time to close" value={h?.avg_time_to_close_days != null ? `${h.avg_time_to_close_days}d` : null} status={data?.health.status} />
          <Metric label="Open collabs" value={h?.collabs_open ?? null} sublabel={h ? `${h.collabs_closed} closed all time` : undefined} status={data?.health.status} />
        </div>
      </section>

      <section>
        <SectionHeading title="Lounges" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Metric label="Rooms opened 30d" value={w?.rooms_created_30d ?? null} status={data?.loungeFunnel.status} />
          <Metric label="Live now" value={w?.live_now ?? null} status={data?.loungeFunnel.status} />
          <Metric label="Participants 30d" value={w?.participants_30d ?? null} status={data?.loungeFunnel.status} />
          <Metric label="Audio minutes 30d" value={w?.audio_minutes_30d ?? null} status={data?.loungeFunnel.status} />
          <Metric label="Messages 30d" value={w?.messages_30d ?? null} status={data?.loungeFunnel.status} />
        </div>
      </section>

      <section>
        <SectionHeading title="Works" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="Created 30d" value={wk?.works_created_30d ?? null} status={data?.worksFunnel.status} />
          <Metric label="Drafts 30d" value={wk?.drafts_30d ?? null} status={data?.worksFunnel.status} />
          <Metric label="Published 30d" value={wk?.published_30d ?? null} status={data?.worksFunnel.status} />
          <Metric label="Collaborative 30d" value={wk?.collaborative_published_30d ?? null} status={data?.worksFunnel.status} />
        </div>
      </section>
    </div>
  );
}

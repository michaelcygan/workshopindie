import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminMarketplace } from "@/lib/admin-analytics.functions";
import { KpiTile } from "@/components/admin/kpi-tile";
import { FunnelChart } from "@/components/admin/funnel";

export const Route = createFileRoute("/admin/marketplace")({ component: MarketplacePage });

function MarketplacePage() {
  const fn = useServerFn(getAdminMarketplace);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "marketplace"], queryFn: () => fn() });
  if (isLoading) return <div className="text-sm text-ink-muted">Loading…</div>;
  const c = data?.collabFunnel as any;
  const w = data?.workshopFunnel as any;
  const wk = data?.worksFunnel as any;
  const h = data?.health as any;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 font-display text-xl text-ink">Collabs</h2>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <KpiTile label="Posted (30d)" value={c?.posts_30d ?? 0} />
          <KpiTile label="Open now" value={c?.open_now ?? 0} tone="good" />
          <KpiTile label="Closed total" value={c?.closed_total ?? 0} />
          <KpiTile label="Apps (30d)" value={c?.applications_30d ?? 0} />
          <KpiTile label="Guest apps (30d)" value={c?.guest_applications_30d ?? 0} sublabel="Logged-out wedge" />
          <KpiTile label="Converted to Work (90d)" value={c?.converted_to_work_90d ?? 0} />
        </div>
        <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
          <h3 className="mb-3 font-display text-base text-ink">Collab funnel (30d)</h3>
          <FunnelChart
            steps={[
              { label: "Posts created", value: c?.posts_30d ?? 0 },
              { label: "Applications", value: (c?.applications_30d ?? 0) + (c?.guest_applications_30d ?? 0) },
              { label: "Closed", value: c?.closed_total ?? 0 },
              { label: "→ Work shipped (90d)", value: c?.converted_to_work_90d ?? 0 },
            ]}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl text-ink">Marketplace health</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <KpiTile label="Avg time to first app" value={h?.avg_time_to_first_app_hours != null ? `${h.avg_time_to_first_app_hours}h` : "—"} />
          <KpiTile label="Avg time to close" value={h?.avg_time_to_close_days != null ? `${h.avg_time_to_close_days}d` : "—"} />
          <KpiTile label="% with vouches (90d)" value={h?.pct_with_vouches_90d != null ? `${h.pct_with_vouches_90d}%` : "—"} />
          <KpiTile label="Open / closed ratio" value={h?.collabs_closed ? `${((h.collabs_open / h.collabs_closed) * 100).toFixed(0)}%` : "—"} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl text-ink">Workshops</h2>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          <KpiTile label="Created (30d)" value={w?.created_30d ?? 0} />
          <KpiTile label="Live now" value={w?.live_now ?? 0} tone="good" />
          <KpiTile label="Apps (30d)" value={w?.apps_30d ?? 0} />
          <KpiTile label="Confirmed (30d)" value={w?.confirmed_30d ?? 0} />
          <KpiTile label="Avg fill % (90d)" value={w?.avg_fill_pct_90d != null ? `${w.avg_fill_pct_90d}%` : "—"} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl text-ink">Works</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <KpiTile label="Created (30d)" value={wk?.works_created_30d ?? 0} />
          <KpiTile label="Drafts (30d)" value={wk?.drafts_30d ?? 0} />
          <KpiTile label="Published (30d)" value={wk?.published_30d ?? 0} />
          <KpiTile label="Collaborative (30d)" value={wk?.collaborative_published_30d ?? 0} />
        </div>
      </section>
    </div>
  );
}

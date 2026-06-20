import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminOverview } from "@/lib/admin-analytics.functions";
import { KpiTile } from "@/components/admin/kpi-tile";
import { MetricChart } from "@/components/admin/metric-chart";

export const Route = createFileRoute("/admin/")({ component: Overview });

function fmt(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString();
}

function Overview() {
  const fn = useServerFn(getAdminOverview);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "overview"], queryFn: () => fn() });

  if (isLoading) return <div className="text-sm text-ink-muted">Loading…</div>;
  const k = data?.kpi as any;
  const stickiness = k?.mau ? Math.round((k.dau / k.mau) * 100) : 0;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 font-display text-xl text-ink">North-star &amp; daily pulse</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          <KpiTile label="Total users" value={fmt(k?.total_users)} />
          <KpiTile label="Signups (7d)" value={fmt(k?.signups_7d)} sublabel={`${fmt(k?.signups_30d)} in 30d`} />
          <KpiTile label="DAU" value={fmt(k?.dau)} />
          <KpiTile label="WAU" value={fmt(k?.wau)} />
          <KpiTile label="MAU" value={fmt(k?.mau)} />
          <KpiTile label="DAU/MAU" value={`${stickiness}%`} sublabel="Stickiness" tone={stickiness >= 20 ? "good" : "warn"} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl text-ink">Creation &amp; marketplace (7d)</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          <KpiTile label="Works shipped" value={fmt(k?.works_published_7d)} sublabel={`${fmt(k?.works_total)} all-time`} />
          <KpiTile label="Collabs posted" value={fmt(k?.collabs_posted_7d)} sublabel={`${fmt(k?.collabs_total)} all-time`} />
          <KpiTile label="Collab apps" value={fmt(k?.collab_applications_7d)} sublabel={`${fmt(k?.collab_guest_applications_7d)} guest`} />
          <KpiTile label="Workshops created" value={fmt(k?.workshops_created_7d)} sublabel={`${fmt(k?.workshops_total)} all-time`} />
          <KpiTile label="Workshop apps" value={fmt(k?.workshop_apps_7d)} />
          <KpiTile label="Event RSVPs" value={fmt(k?.event_rsvps_7d)} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl text-ink">Revenue &amp; trust</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiTile label="Active Plus subs" value={fmt(k?.active_subs)} tone="good" />
          <KpiTile label="New follows (7d)" value={fmt(k?.follows_7d)} />
          <KpiTile label="Open reports" value={fmt(k?.open_reports)} tone={k?.open_reports ? "warn" : "default"} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <h3 className="mb-2 font-display text-lg text-ink">Daily signups (365d)</h3>
          <MetricChart data={(data?.signups ?? []) as any} xKey="day" yKey="signups" />
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <h3 className="mb-2 font-display text-lg text-ink">DAU (90d)</h3>
          <MetricChart data={(data?.dau ?? []) as any} xKey="day" yKey="dau" color="hsl(var(--accent))" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl text-ink">Engagement by surface (7d)</h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-3 py-2 text-left">Surface</th>
                <th className="px-3 py-2 text-right">Active users</th>
                <th className="px-3 py-2 text-right">Actions</th>
                <th className="px-3 py-2 text-right">Per active</th>
              </tr>
            </thead>
            <tbody>
              {(data?.surfaces ?? []).map((s: any) => (
                <tr key={s.surface} className="border-t border-border">
                  <td className="px-3 py-2 text-ink">{s.surface}</td>
                  <td className="px-3 py-2 text-right">{fmt(s.active_users)}</td>
                  <td className="px-3 py-2 text-right">{fmt(s.actions)}</td>
                  <td className="px-3 py-2 text-right">{s.active_users > 0 ? (s.actions / s.active_users).toFixed(2) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

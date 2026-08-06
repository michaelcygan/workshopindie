import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminGeo } from "@/lib/admin-analytics.functions";
import { WorldMap } from "@/components/admin/world-map";
import { LocalitiesPanel } from "@/components/admin/localities-panel";
import { LaunchQueuePanel } from "@/components/admin/launch-queue-panel";
import { Metric, SectionHeading, UpdatedAt, Unavailable } from "@/components/admin/metric";
import { NarrativeList } from "@/components/admin/narrative-list";
import { EMERGING_MIN_MEMBERS, METRIC_DEFINITIONS, delta, fmtNumber } from "@/lib/analytics";
import { isOk, rows } from "@/lib/analytics/envelope";
import { geoNarrative } from "@/lib/analytics/narrative";

export const Route = createFileRoute("/admin/geo")({ component: GeoPage });

const TABS = [
  { id: "signals", label: "Markets" },
  { id: "localities", label: "Localities" },
  { id: "queue", label: "Launch queue" },
] as const;

function GeoPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("signals");
  return (
    <div className="space-y-6">
      <div className="flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full border px-3 py-1.5 text-sm ${tab === t.id ? "border-ink bg-ink text-surface" : "border-border text-ink-soft"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "signals" ? <SignalsPanel /> : null}
      {tab === "localities" ? <LocalitiesPanel /> : null}
      {tab === "queue" ? <LaunchQueuePanel /> : null}
    </div>
  );
}

function DeltaCell({ current, prior }: { current: number; prior: number }) {
  const d = delta(current, prior);
  return (
    <span className="text-ink-soft">
      {d.kind === "none" ? "—" : d.kind === "absolute" ? `${d.abs > 0 ? "+" : ""}${d.abs}` : `${d.abs > 0 ? "+" : ""}${d.pct.toFixed(0)}%`}
    </span>
  );
}

function SignalsPanel() {
  const fn = useServerFn(getAdminGeo);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "geo"], queryFn: () => fn(), refetchOnWindowFocus: false });
  if (isLoading) return <div className="text-sm text-ink-muted">Loading…</div>;

  const kpi = isOk(data?.kpi) ? (data!.kpi.data as any) : null;
  const cities = rows<any>(data?.cities).filter((c) => c.members > 0);
  const countries = rows<any>(data?.countries).filter((c) => c.members > 0);
  const withMembers = cities.length;
  const activeCities = cities.filter((c) => (c.mau ?? 0) > 0).length;
  const emerging = cities
    .filter((c) => c.members >= EMERGING_MIN_MEMBERS && (c.new_30d ?? 0) > (c.new_prev_30d ?? 0))
    .sort((a, b) => b.new_30d - a.new_30d)
    .slice(0, 6);

  const mapCities = cities.map((c) => ({ ...c, active_users: c.mau ?? 0 }));

  return (
    <div className="space-y-8">
      <section>
        <SectionHeading title="Geography" hint="Home city is self-declared by members." right={<UpdatedAt at={data?.fetchedAt} />} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="Cities with members" value={withMembers} status={data?.cities.status} />
          <Metric label="Active cities" value={activeCities} status={data?.cities.status} definition={METRIC_DEFINITIONS.active_city.definition} />
          <Metric label="Countries" value={countries.length} status={data?.countries.status} />
          <Metric
            label="Members without a city"
            value={kpi && withMembers >= 0 ? Math.max(0, (kpi.members_total ?? 0) - cities.reduce((a, c) => a + c.members, 0)) : null}
            status={data?.kpi.status}
          />
        </div>
      </section>

      {data?.cities.status === "unavailable" ? <Unavailable /> : <WorldMap cities={mapCities as any} />}

      <NarrativeList items={geoNarrative(cities)} />

      {emerging.length ? (
        <section>
          <SectionHeading title="Emerging places" hint={`Cities with at least ${EMERGING_MIN_MEMBERS} members growing faster than the prior 30 days.`} />
          <div className="grid gap-3 md:grid-cols-3">
            {emerging.map((c) => (
              <div key={c.city_id} className="rounded-2xl border border-border bg-surface p-4">
                <div className="font-display text-lg text-ink">{c.name}</div>
                <div className="text-xs text-ink-muted">{c.country}</div>
                <div className="mt-2 text-sm text-ink-soft">
                  {fmtNumber(c.members)} members · +{fmtNumber(c.new_30d)} in 30d · {fmtNumber(c.mau)} active
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="border-b border-border bg-muted/50 px-3 py-2 text-xs uppercase tracking-wide text-ink-muted">Cities</div>
          <div className="max-h-[520px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-ink-muted">
                <tr>
                  <th className="px-3 py-2 text-left">City</th>
                  <th className="px-3 py-2 text-right">Members</th>
                  <th className="px-3 py-2 text-right">New 30d</th>
                  <th className="px-3 py-2 text-right">vs prior</th>
                  <th className="px-3 py-2 text-right">Active</th>
                  <th className="px-3 py-2 text-right">Works</th>
                </tr>
              </thead>
              <tbody>
                {cities.slice(0, 100).map((c) => (
                  <tr key={c.city_id} className="border-t border-border">
                    <td className="px-3 py-1.5 text-ink">{c.name}{c.country ? `, ${c.country}` : ""}</td>
                    <td className="px-3 py-1.5 text-right">{fmtNumber(c.members)}</td>
                    <td className="px-3 py-1.5 text-right">{fmtNumber(c.new_30d)}</td>
                    <td className="px-3 py-1.5 text-right"><DeltaCell current={c.new_30d ?? 0} prior={c.new_prev_30d ?? 0} /></td>
                    <td className="px-3 py-1.5 text-right text-ink-soft">{fmtNumber(c.mau)}</td>
                    <td className="px-3 py-1.5 text-right text-ink-soft">{fmtNumber(c.works_30d)}</td>
                  </tr>
                ))}
                {!cities.length ? <tr><td colSpan={6} className="px-3 py-6 text-center text-ink-muted">No cities yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="border-b border-border bg-muted/50 px-3 py-2 text-xs uppercase tracking-wide text-ink-muted">Countries</div>
          <div className="max-h-[520px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-ink-muted">
                <tr>
                  <th className="px-3 py-2 text-left">Country</th>
                  <th className="px-3 py-2 text-right">Members</th>
                  <th className="px-3 py-2 text-right">New 30d</th>
                  <th className="px-3 py-2 text-right">Active</th>
                  <th className="px-3 py-2 text-right">Activated</th>
                </tr>
              </thead>
              <tbody>
                {countries.map((c) => (
                  <tr key={c.country_code ?? c.country} className="border-t border-border">
                    <td className="px-3 py-1.5 text-ink">{c.country ?? "Unknown"}</td>
                    <td className="px-3 py-1.5 text-right">{fmtNumber(c.members)}</td>
                    <td className="px-3 py-1.5 text-right">{fmtNumber(c.new_30d)}</td>
                    <td className="px-3 py-1.5 text-right text-ink-soft">{fmtNumber(c.mau)}</td>
                    <td className="px-3 py-1.5 text-right text-ink-soft">{fmtNumber(c.activated)}</td>
                  </tr>
                ))}
                {!countries.length ? <tr><td colSpan={5} className="px-3 py-6 text-center text-ink-muted">No countries yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminGeo } from "@/lib/admin-analytics.functions";
import { WorldMap } from "@/components/admin/world-map";
import { LocalitiesPanel } from "@/components/admin/localities-panel";
import { LaunchQueuePanel } from "@/components/admin/launch-queue-panel";

export const Route = createFileRoute("/admin/geo")({ component: GeoPage });

const TABS = [
  { id: "signals", label: "Signals" },
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
            className={`rounded-full border px-3 py-1.5 text-sm ${
              tab === t.id ? "border-ink bg-ink text-surface" : "border-border text-ink-soft"
            }`}
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

function SignalsPanel() {
  const fn = useServerFn(getAdminGeo);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "geo"], queryFn: () => fn() });
  if (isLoading) return <div className="text-sm text-ink-muted">Loading…</div>;
  const cities = (data?.cities ?? []) as any[];
  const countries = (data?.countries ?? []) as any[];

  return (
    <div className="space-y-6">
      <WorldMap cities={cities as any} />


      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="border-b border-border bg-muted/50 px-3 py-2 text-xs uppercase tracking-wide text-ink-muted">Top cities (7d)</div>
          <table className="w-full text-sm">
            <thead className="text-xs text-ink-muted">
              <tr>
                <th className="px-3 py-2 text-left">City</th>
                <th className="px-3 py-2 text-right">Active</th>
                <th className="px-3 py-2 text-right">Members</th>
                <th className="px-3 py-2 text-right">Works</th>
                <th className="px-3 py-2 text-right">Collabs</th>
              </tr>
            </thead>
            <tbody>
              {cities.slice(0, 30).map((c: any) => (
                <tr key={c.city_id} className="border-t border-border">
                  <td className="px-3 py-1.5 text-ink">{c.name}{c.country ? `, ${c.country}` : ""}</td>
                  <td className="px-3 py-1.5 text-right">{c.active_users}</td>
                  <td className="px-3 py-1.5 text-right text-ink-soft">{c.members}</td>
                  <td className="px-3 py-1.5 text-right">{c.works_7d}</td>
                  <td className="px-3 py-1.5 text-right">{c.collabs_7d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="border-b border-border bg-muted/50 px-3 py-2 text-xs uppercase tracking-wide text-ink-muted">Countries</div>
          <table className="w-full text-sm">
            <thead className="text-xs text-ink-muted">
              <tr>
                <th className="px-3 py-2 text-left">Country</th>
                <th className="px-3 py-2 text-right">Active (7d)</th>
                <th className="px-3 py-2 text-right">Members</th>
                <th className="px-3 py-2 text-right">Works</th>
                <th className="px-3 py-2 text-right">Collabs</th>
              </tr>
            </thead>
            <tbody>
              {countries.slice(0, 50).map((c: any) => (
                <tr key={c.country} className="border-t border-border">
                  <td className="px-3 py-1.5 text-ink">{c.country}</td>
                  <td className="px-3 py-1.5 text-right">{c.active_users}</td>
                  <td className="px-3 py-1.5 text-right text-ink-soft">{c.members}</td>
                  <td className="px-3 py-1.5 text-right">{c.works_7d}</td>
                  <td className="px-3 py-1.5 text-right">{c.collabs_7d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

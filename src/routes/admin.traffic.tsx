import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight } from "lucide-react";
import {
  getAdminTraffic,
  getAdminTrafficLive,
  getAdminTrafficOverview,
} from "@/lib/admin-analytics.functions";
import { MetricChart } from "@/components/admin/metric-chart";
import { TrafficLiveRow, type LiveSnapshot } from "@/components/admin/traffic-live-row";
import {
  Metric,
  RatioMetric,
  SectionHeading,
  UpdatedAt,
  Unavailable,
} from "@/components/admin/metric";
import { fmtNumber } from "@/lib/analytics";
import { isOk, rows, type Panel } from "@/lib/analytics/envelope";

export const Route = createFileRoute("/admin/traffic")({ component: TrafficPage });

const RANGES = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "All", days: 0 },
];

function Table({
  panel,
  columns,
  rowsData,
  empty = "No traffic yet",
}: {
  panel?: Panel<unknown>;
  columns: string[];
  rowsData: (string | number | null)[][];
  empty?: string;
}) {
  if (panel?.status === "unavailable") return <Unavailable />;
  if (!rowsData.length)
    return <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-ink-muted">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-ink-muted">
            {columns.map((c, i) => (
              <th key={c} className={`px-3 py-2 font-medium ${i > 0 ? "text-right" : ""}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowsData.map((r, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0">
              {r.map((cell, j) => (
                <td
                  key={j}
                  className={`px-3 py-2 ${j > 0 ? "text-right tabular-nums text-ink-soft" : "truncate text-ink"}`}
                >
                  {typeof cell === "number" ? fmtNumber(cell) : (cell ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function pct(n: number | null | undefined, d: number | null | undefined): string {
  if (!d || n === null || n === undefined) return "—";
  return `${Math.round((n / d) * 1000) / 10}%`;
}

/** Seconds since a timestamp, ticking once a second for the live marker. */
function useAgo(iso: string | undefined): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.round((now - t) / 1000));
}

function TrafficPage() {
  const [days, setDays] = useState(30);
  const [geoView, setGeoView] = useState<"cities" | "countries">("cities");
  const [openCountry, setOpenCountry] = useState<string | null>(null);

  const fn = useServerFn(getAdminTraffic);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "traffic", days],
    queryFn: () => fn({ data: { days } }),
    refetchOnWindowFocus: false,
  });

  // The headline numbers are the only historical query allowed to poll. Every
  // other panel below stays bound to the selected window and is never
  // recomputed on a timer.
  const overviewFn = useServerFn(getAdminTrafficOverview);
  const { data: liveOverview } = useQuery({
    queryKey: ["admin", "traffic", "overview", days],
    queryFn: () => overviewFn({ data: { days } }),
    refetchInterval: 12_000,
    refetchIntervalInBackground: false,
  });

  const liveFn = useServerFn(getAdminTrafficLive);
  const { data: live } = useQuery({
    queryKey: ["admin", "traffic", "live"],
    queryFn: () => liveFn({ data: {} }),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });

  const overviewPanel = isOk(liveOverview?.overview) ? liveOverview!.overview : data?.overview;
  const o = isOk(overviewPanel) ? (overviewPanel.data as any) : null;
  const views = o?.page_views ?? null;
  const visits = o?.visits ?? null;
  const snapshot = (isOk(live?.snapshot) ? (live!.snapshot.data as LiveSnapshot) : null) ?? null;
  const agoSeconds = useAgo(liveOverview?.fetchedAt ?? data?.fetchedAt);
  const daily = rows<any>(data?.daily).map((r) => ({
    day: String(r.day).slice(5),
    views: Number(r.page_views),
  }));

  const locationRows = rows<any>(data?.locations);
  const citiesByCountry = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const r of locationRows) {
      const key = r.country ?? "Unknown";
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => Number(b.visits) - Number(a.visits));
    return map;
  }, [locationRows]);

  return (
    <div className="space-y-10">
      <section>
        <SectionHeading
          title="Traffic"
          hint="Who is visiting Workshop and how do they move through it? Anonymous, first-party, obvious bots filtered."
          right={
            <div className="flex items-center gap-3">
              <div className="flex rounded-full border border-border bg-surface p-0.5">
                {RANGES.map((r) => (
                  <button
                    key={r.label}
                    onClick={() => setDays(r.days)}
                    className={`rounded-full px-3 py-1 text-xs ${
                      days === r.days ? "bg-primary text-primary-foreground" : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <UpdatedAt at={data?.fetchedAt} />
            </div>
          }
        />
        {isLoading ? (
          <div className="text-sm text-ink-muted">Loading…</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Metric
              label="Page views"
              value={views}
              status={data?.overview.status}
              definition="Recorded page views in the selected window. Private surfaces (admin, DMs, auth) are never recorded."
            />
            <Metric
              label="Unique visitors"
              value={o?.unique_visitors ?? null}
              status={data?.overview.status}
              definition="Distinct anonymous browser IDs. One person on a phone and a laptop counts twice — we never fingerprint to merge devices."
            />
            <Metric
              label="Visits"
              value={visits}
              status={data?.overview.status}
              definition="Distinct sessions. A session ends after 30 minutes of inactivity."
            />
            <Metric
              label="Pages / visit"
              value={visits ? Math.round((views / visits) * 100) / 100 : null}
              status={data?.overview.status}
              definition="Page views divided by visits."
            />
            <RatioMetric
              label="Bounce rate"
              numerator={o?.bounced_visits}
              denominator={visits}
              status={data?.overview.status}
              definition="Visits containing exactly one recorded page view, divided by all visits."
            />
          </div>
        )}
        {o ? (
          <p className="mt-2 text-xs text-ink-muted">
            Member traffic {pct(o.member_views, views)} · Guest traffic {pct(o.guest_views, views)}
          </p>
        ) : null}
      </section>

      <section>
        <SectionHeading title="Daily page views" />
        {data?.daily.status === "unavailable" ? <Unavailable /> : <MetricChart data={daily} xKey="day" yKey="views" />}
      </section>

      <section>
        <SectionHeading title="Pages" hint="Most viewed pages in the window." />
        <Table
          panel={data?.pages}
          columns={["Page", "Views", "Uniques", "Entries", "Bounce"]}
          rowsData={rows<any>(data?.pages).map((r) => [
            r.path,
            Number(r.page_views),
            Number(r.unique_visitors),
            Number(r.entries),
            pct(Number(r.bounces), Number(r.entries)),
          ])}
        />
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <SectionHeading title="Sources" hint="External referring host on the first page of a visit." />
          <Table
            panel={data?.referrers}
            columns={["Source", "Visits", "Uniques"]}
            rowsData={rows<any>(data?.referrers).map((r) => [
              r.source,
              Number(r.visits),
              Number(r.unique_visitors),
            ])}
          />
        </section>
        <section>
          <SectionHeading
            title="Locations"
            hint="Visitor location from coarse edge request geography. Unknown where unavailable — this is not member geography."
          />
          <Table
            panel={data?.locations}
            columns={["City", "Uniques", "Visits", "Views"]}
            rowsData={rows<any>(data?.locations).map((r) => [
              [r.city, r.region, r.country].filter(Boolean).join(", ") || "Unknown",
              Number(r.unique_visitors),
              Number(r.visits),
              Number(r.page_views),
            ])}
          />
        </section>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <SectionHeading title="Entry pages" hint="First page of a visit." />
          <Table
            panel={data?.entries}
            columns={["Entry page", "Visits", "Bounce"]}
            rowsData={rows<any>(data?.entries).map((r) => [
              r.path,
              Number(r.visits),
              pct(Number(r.bounces), Number(r.visits)),
            ])}
          />
        </section>
        <section>
          <SectionHeading title="Exit pages" hint="Last page of a visit. Descriptive, not a verdict." />
          <Table
            panel={data?.exits}
            columns={["Exit page", "Visits"]}
            rowsData={rows<any>(data?.exits).map((r) => [r.path, Number(r.visits)])}
          />
        </section>
      </div>

      <section>
        <SectionHeading title="Common paths" hint="Most frequent page-to-page steps inside a visit." />
        <Table
          panel={data?.transitions}
          columns={["Path", "Count"]}
          rowsData={rows<any>(data?.transitions).map((r) => [
            `${r.from_path} → ${r.to_path}`,
            Number(r.transitions),
          ])}
        />
      </section>

      <section>
        <SectionHeading title="Countries" />
        <Table
          panel={data?.countries}
          columns={["Country", "Uniques", "Visits", "Views"]}
          rowsData={rows<any>(data?.countries).map((r) => [
            r.country ?? "Unknown",
            Number(r.unique_visitors),
            Number(r.visits),
            Number(r.page_views),
          ])}
        />
      </section>
    </div>
  );
}

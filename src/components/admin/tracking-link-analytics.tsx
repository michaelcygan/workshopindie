import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { MetricChart } from "@/components/admin/metric-chart";
import { SectionHeading, Unavailable } from "@/components/admin/metric";
import { isOk, rows, type Panel } from "@/lib/analytics/envelope";
import {
  getTrackingLinkDetail,
  listTrackingLinks,
} from "@/lib/tracking-links.functions";
import { formatClickLocation } from "@/lib/tracking-links.shared";
import type { TrackingLinkRow } from "@/components/admin/tracking-links-panel";

/**
 * Tracking-link reporting on /admin/growth.
 *
 * Deliberately additive: the acquisition funnel above it still measures
 * in-app share links via `share_events`. This section measures *campaign*
 * links only, so the two numbers never get conflated.
 */
export function TrackingLinkAnalytics() {
  const list = useServerFn(listTrackingLinks);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "growth", "tracking-links"],
    queryFn: () => list(),
    refetchOnWindowFocus: false,
  });

  const [openId, setOpenId] = useState<string | null>(null);
  const links = (data?.links ?? []) as TrackingLinkRow[];

  return (
    <section>
      <SectionHeading
        title="Tracking links"
        hint="Campaign URLs (/go/…) placed on posters, QR codes and bios. Separate from in-app share links."
      />
      <div className="rounded-2xl border border-border bg-surface p-5">
        {isLoading ? (
          <div className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-ink-muted" /></div>
        ) : isError ? (
          <Unavailable />
        ) : links.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">
            No tracking links yet. Create one in <Link to="/admin/links" className="underline">Links</Link>.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="py-2 pr-3 font-medium">Link</th>
                  <th className="py-2 pr-3 font-medium">Visits</th>
                  <th className="py-2 pr-3 font-medium">Members</th>
                  <th className="py-2 pr-3 font-medium">New</th>
                  <th className="py-2 pr-3 font-medium">7d</th>
                  <th className="py-2 pr-3 font-medium">Last visit</th>
                </tr>
              </thead>
              <tbody>
                {links.map((l) => (
                  <TrackingRow
                    key={l.id}
                    link={l}
                    open={openId === l.id}
                    onToggle={() => setOpenId(openId === l.id ? null : l.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function TrackingRow({
  link,
  open,
  onToggle,
}: {
  link: TrackingLinkRow;
  open: boolean;
  onToggle: () => void;
}) {
  const detail = useServerFn(getTrackingLinkDetail);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "tracking-link", link.id],
    queryFn: () => detail({ data: { id: link.id, days: 90 } }),
    enabled: open,
    refetchOnWindowFocus: false,
  });

  // The server fn returns three Panel<T> envelopes; widen once so the JSX
  // below can read `.status` without fighting inference across the RPC boundary.
  const d = data as
    | { daily: Panel<any>; locations: Panel<any>; referrers: Panel<any> }
    | undefined;
  const daily = rows<any>(d?.daily);
  const locations = rows<any>(d?.locations);
  const referrers = rows<any>(d?.referrers);

  return (
    <>
      <tr className="border-b border-border/60">
        <td className="py-2.5 pr-3">
          <button type="button" onClick={onToggle} className="flex items-start gap-2 text-left">
            {open ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />}
            <span>
              <span className="block font-medium text-ink">{link.name}</span>
              <span className="block font-mono text-xs text-ink-muted">/go/{link.slug}</span>
            </span>
          </button>
        </td>
        <td className="py-2.5 pr-3 tabular-nums text-ink">{link.total_clicks}</td>
        <td className="py-2.5 pr-3 tabular-nums text-ink-muted">{link.member_clicks}</td>
        <td className="py-2.5 pr-3 tabular-nums text-ink-muted">{link.guest_clicks}</td>
        <td className="py-2.5 pr-3 tabular-nums text-ink-muted">{link.clicks_7d}</td>
        <td className="py-2.5 pr-3 text-xs text-ink-muted">
          {link.last_click_at ? new Date(link.last_click_at).toLocaleDateString() : "—"}
        </td>
      </tr>

      {open && (
        <tr className="border-b border-border/60 bg-muted/30">
          <td colSpan={6} className="p-4">
            {isLoading ? (
              <div className="py-6 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-ink-muted" /></div>
            ) : (
              <div className="grid gap-6 md:grid-cols-[2fr_1fr_1fr]">
                <div>
                  <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">Visits per day (90d)</h4>
                  {isOk(d?.daily) ? (
                    <MetricChart data={daily as any} xKey="day" yKey="total" kind="bar" />
                  ) : (d?.daily as Panel<any> | undefined)?.status === "unavailable" ? (
                    <Unavailable />
                  ) : (
                    <p className="text-sm text-ink-muted">No visits yet.</p>
                  )}
                </div>
                <BreakdownList
                  title="Locations"
                  empty="No location data."
                  items={locations.map((r) => ({
                    label: formatClickLocation(r.city, r.region, r.country),
                    value: r.total,
                  }))}
                  unavailable={d?.locations.status === "unavailable"}
                />
                <BreakdownList
                  title="Referrers"
                  empty="No referrer data."
                  items={referrers.map((r) => ({ label: r.referrer, value: r.total }))}
                  unavailable={d?.referrers.status === "unavailable"}
                />
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function BreakdownList({
  title,
  items,
  empty,
  unavailable,
}: {
  title: string;
  items: { label: string; value: number }[];
  empty: string;
  unavailable?: boolean;
}) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">{title}</h4>
      {unavailable ? (
        <Unavailable />
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-muted">{empty}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {items.slice(0, 8).map((i) => (
            <li key={i.label} className="flex items-center justify-between gap-3">
              <span className="truncate text-ink-muted">{i.label}</span>
              <span className="tabular-nums text-ink">{i.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

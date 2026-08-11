import { useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { pageLabel } from "@/lib/traffic/page-label";
import { cityLabel } from "@/lib/traffic/city-label";

export type LiveSnapshot = {
  total: number;
  members: number;
  guests: number;
  pages: { path: string; live: number; heating_up?: boolean }[];
  cities: { city: string | null; region: string | null; country: string | null; live: number }[];
  sources: { source: string; live: number }[];
};

function List({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { key: string; label: string; sub?: string | null; value: number; hot?: boolean }[];
  empty: string;
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="py-1 text-xs text-ink-muted">{empty}</p>
      ) : (
        <ul className="space-y-0.5">
          {rows.map((r) => (
            <li key={r.key} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-ink">
                {r.label}
                {r.hot ? <span className="ml-1 text-ink-muted">↑</span> : null}
                {r.sub && r.sub !== r.label ? (
                  <span className="ml-1 truncate text-[11px] text-ink-muted">{r.sub}</span>
                ) : null}
              </span>
              <span className="tabular-nums text-ink-soft">{r.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * One dense line: how many people are on Workshop right now, and where they
 * are. Historical analytics answers what happened; this answers what is
 * happening. If the live query fails, the row simply isn't there.
 */
export function TrafficLiveRow({ snapshot }: { snapshot: LiveSnapshot | null }) {
  const topThree = useMemo(
    () => (snapshot?.pages ?? []).slice(0, 3),
    [snapshot],
  );

  if (!snapshot) return null;

  return (
    <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-baseline gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-ink transition-colors hover:border-ink-muted"
          >
            <span className="text-primary">●</span>
            <span className="font-semibold tabular-nums">{snapshot.total}</span>
            <span className="uppercase tracking-[0.12em] text-ink-muted">live now</span>
            <span className="text-ink-muted">
              · {snapshot.guests} guests / {snapshot.members} members
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 space-y-4">
          <div className="flex items-baseline justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              Live now
            </p>
            <p className="text-lg font-semibold tabular-nums text-ink">{snapshot.total}</p>
          </div>

          <List
            title="Most active right now"
            empty="Nobody on a page yet"
            rows={snapshot.pages.map((p) => ({
              key: p.path,
              label: pageLabel(p.path),
              sub: p.path,
              value: p.live,
              hot: !!p.heating_up,
            }))}
          />

          <List
            title="Cities right now"
            empty="No edge geography available"
            rows={snapshot.cities.map((c, i) => ({
              key: `${c.city}-${c.region}-${c.country}-${i}`,
              label: cityLabel(c.city, c.region, c.country),
              value: c.live,
            }))}
          />

          <List
            title="Arriving from"
            empty="No sources yet"
            rows={snapshot.sources.map((s) => ({
              key: s.source,
              label: s.source,
              value: s.live,
            }))}
          />

          <p className="border-t border-border pt-2 text-xs text-ink-muted">
            Members {snapshot.members} · Guests {snapshot.guests}
          </p>
        </PopoverContent>
      </Popover>

      {topThree.length ? (
        <p className="text-xs text-ink-muted">
          Most active:{" "}
          {topThree.map((p, i) => (
            <span key={p.path}>
              {i > 0 ? " · " : ""}
              <span className="text-ink">{pageLabel(p.path)}</span> {p.live}
              {p.heating_up ? " ↑" : ""}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}

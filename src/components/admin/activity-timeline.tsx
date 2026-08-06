import { SURFACE_LABELS, fmtNumber } from "@/lib/analytics";
import { Unavailable } from "./metric";

type DayRow = { day: string; surface: string; is_creative: boolean; actions: number };

function dayKeys(days: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/**
 * 90-day activity strip for one member, read off the immutable activity spine.
 * Creative days are emphasised; passive (presence-only) days stay muted.
 */
export function ActivityTimeline({
  rows,
  unavailable,
  days = 90,
}: {
  rows: DayRow[];
  unavailable?: boolean;
  days?: number;
}) {
  if (unavailable) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <Unavailable />
      </div>
    );
  }

  const byDay = new Map<string, { creative: number; passive: number; surfaces: Map<string, number> }>();
  for (const r of rows) {
    const key = String(r.day).slice(0, 10);
    const e = byDay.get(key) ?? { creative: 0, passive: 0, surfaces: new Map<string, number>() };
    if (r.is_creative) e.creative += r.actions;
    else e.passive += r.actions;
    e.surfaces.set(r.surface, (e.surfaces.get(r.surface) ?? 0) + r.actions);
    byDay.set(key, e);
  }

  const keys = dayKeys(days);
  const activeDays = keys.filter((k) => byDay.has(k)).length;
  const creativeDays = keys.filter((k) => (byDay.get(k)?.creative ?? 0) > 0).length;

  // Per-surface rollup
  const surfaceTotals = new Map<string, { actions: number; days: Set<string>; last: string }>();
  for (const r of rows) {
    const key = String(r.day).slice(0, 10);
    const e = surfaceTotals.get(r.surface) ?? { actions: 0, days: new Set<string>(), last: key };
    e.actions += r.actions;
    e.days.add(key);
    if (key > e.last) e.last = key;
    surfaceTotals.set(r.surface, e);
  }
  const surfaces = Array.from(surfaceTotals.entries()).sort((a, b) => b[1].actions - a[1].actions);

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h3 className="font-display text-lg text-ink">Activity</h3>
          <p className="text-xs text-ink-muted">
            Last {days} days · {fmtNumber(activeDays)} active {activeDays === 1 ? "day" : "days"}, {fmtNumber(creativeDays)} with a
            creative action.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-[3px]">
        {keys.map((k) => {
          const e = byDay.get(k);
          const tone = !e
            ? "bg-muted"
            : e.creative > 0
              ? e.creative >= 5
                ? "bg-primary"
                : "bg-primary/50"
              : "bg-ink/15";
          const detail = e
            ? Array.from(e.surfaces.entries())
                .map(([s, n]) => `${SURFACE_LABELS[s] ?? s}: ${n}`)
                .join("\n")
            : "No activity";
          return <span key={k} title={`${k}\n${detail}`} className={`h-3 w-3 rounded-[3px] ${tone}`} />;
        })}
      </div>

      {surfaces.length ? (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="py-1.5 text-left">Surface</th>
                <th className="py-1.5 text-right">Days</th>
                <th className="py-1.5 text-right">Actions</th>
                <th className="py-1.5 text-right">Last</th>
              </tr>
            </thead>
            <tbody>
              {surfaces.map(([s, e]) => (
                <tr key={s} className="border-t border-border">
                  <td className="py-1.5 text-ink">{SURFACE_LABELS[s] ?? s}</td>
                  <td className="py-1.5 text-right text-ink-soft">{fmtNumber(e.days.size)}</td>
                  <td className="py-1.5 text-right text-ink-soft">{fmtNumber(e.actions)}</td>
                  <td className="py-1.5 text-right text-ink-soft">{new Date(e.last).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-sm text-ink-muted">No recorded activity in this window.</p>
      )}
    </div>
  );
}

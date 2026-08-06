import { SURFACE_LABELS, delta, fmtNumber } from "@/lib/analytics";
import { Unavailable } from "./metric";

type Row = {
  surface: string;
  active_users: number;
  actions: number;
  prev_active_users: number;
  prev_actions: number;
  returning_users: number;
  activated_users: number;
};

export function SurfaceTable({
  rows,
  unavailable,
  denominator,
}: {
  rows: Row[];
  unavailable?: boolean;
  /** MAU, when you want a "% of active members" column. */
  denominator?: number | null;
}) {
  if (unavailable) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <Unavailable />
      </div>
    );
  }
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-ink-muted">
        No activity recorded in the last 30 days.
      </div>
    );
  }
  const sorted = rows.slice().sort((a, b) => b.active_users - a.active_users);
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-ink-muted">
          <tr>
            <th className="px-3 py-2 text-left">Surface</th>
            <th className="px-3 py-2 text-right">Members</th>
            <th className="px-3 py-2 text-right">vs prior 30d</th>
            <th className="px-3 py-2 text-right">Actions</th>
            <th className="px-3 py-2 text-right">Per member</th>
            <th className="px-3 py-2 text-right">Returning</th>
            {denominator ? <th className="px-3 py-2 text-right">% of MAU</th> : null}
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => {
            const d = delta(s.active_users, s.prev_active_users);
            return (
              <tr key={s.surface} className="border-t border-border">
                <td className="px-3 py-2 text-ink">
                  {SURFACE_LABELS[s.surface] ?? s.surface}
                  {s.surface === "presence" ? (
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-ink-muted">passive</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right">{fmtNumber(s.active_users)}</td>
                <td className="px-3 py-2 text-right text-ink-soft">
                  {d.kind === "none" ? "—" : d.kind === "absolute" ? `${d.abs > 0 ? "+" : ""}${d.abs}` : `${d.abs > 0 ? "+" : ""}${d.pct.toFixed(0)}%`}
                </td>
                <td className="px-3 py-2 text-right">{fmtNumber(s.actions)}</td>
                <td className="px-3 py-2 text-right text-ink-soft">
                  {s.active_users > 0 ? (s.actions / s.active_users).toFixed(1) : "—"}
                </td>
                <td className="px-3 py-2 text-right text-ink-soft">{fmtNumber(s.returning_users)}</td>
                {denominator ? (
                  <td className="px-3 py-2 text-right text-ink-soft">
                    {denominator ? `${Math.round((s.active_users / denominator) * 100)}%` : "—"}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type Row = { cohort_week: string; cohort_size: number; week_n: number; retained: number; retained_pct: number };

export function CohortHeatmap({ rows }: { rows: Row[] }) {
  if (!rows?.length) return <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">No cohort data yet</div>;
  // Build a matrix
  const cohorts = Array.from(new Set(rows.map((r) => r.cohort_week))).sort();
  const weeks = Array.from({ length: 9 }, (_, i) => i); // 0..8
  const map = new Map<string, Row>();
  for (const r of rows) map.set(`${r.cohort_week}|${r.week_n}`, r);
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <table className="w-full text-xs">
        <thead className="bg-muted/50 text-ink-muted">
          <tr>
            <th className="px-2 py-2 text-left">Cohort week</th>
            <th className="px-2 py-2 text-right">Size</th>
            {weeks.map((w) => (
              <th key={w} className="px-2 py-2 text-center">W{w}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((wk) => {
            const size = map.get(`${wk}|0`)?.cohort_size ?? 0;
            return (
              <tr key={wk} className="border-t border-border">
                <td className="px-2 py-1.5 text-left text-ink">{wk}</td>
                <td className="px-2 py-1.5 text-right text-ink-soft">{size}</td>
                {weeks.map((w) => {
                  const r = map.get(`${wk}|${w}`);
                  const pct = r?.retained_pct ?? 0;
                  const intensity = Math.max(0, Math.min(1, pct / 100));
                  const bg = pct > 0 ? `hsl(var(--primary) / ${0.08 + intensity * 0.6})` : "transparent";
                  return (
                    <td key={w} className="px-2 py-1.5 text-center" style={{ background: bg }}>
                      {pct > 0 ? `${pct}%` : "—"}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

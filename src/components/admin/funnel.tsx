type Step = { label: string; value: number };

export function FunnelChart({ steps }: { steps: Step[] }) {
  if (!steps.length) return null;
  const max = Math.max(...steps.map((s) => s.value), 1);
  return (
    <div className="space-y-2">
      {steps.map((s, i) => {
        const pct = (s.value / max) * 100;
        const drop = i > 0 && steps[i - 1].value > 0 ? Math.round((s.value / steps[i - 1].value) * 100) : null;
        return (
          <div key={s.label} className="flex items-center gap-3">
            <div className="w-40 shrink-0 text-sm text-ink-soft">{s.label}</div>
            <div className="relative flex-1 rounded-lg bg-muted">
              <div className="h-7 rounded-lg bg-primary/80" style={{ width: `${pct}%` }} />
              <div className="absolute inset-0 flex items-center px-2 text-xs font-medium text-ink">
                {s.value.toLocaleString()}
                {drop !== null ? <span className="ml-2 text-ink-muted">({drop}%)</span> : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

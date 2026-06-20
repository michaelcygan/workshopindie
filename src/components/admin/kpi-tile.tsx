type Props = {
  label: string;
  value: string | number;
  sublabel?: string;
  tone?: "default" | "good" | "warn" | "danger";
};
export function KpiTile({ label, value, sublabel, tone = "default" }: Props) {
  const toneCls =
    tone === "good" ? "text-emerald-600"
    : tone === "warn" ? "text-amber-600"
    : tone === "danger" ? "text-rose-600"
    : "text-ink";
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="text-xs uppercase tracking-wide text-ink-muted">{label}</div>
      <div className={`mt-1 font-display text-2xl ${toneCls}`}>{value}</div>
      {sublabel ? <div className="mt-0.5 text-xs text-ink-soft">{sublabel}</div> : null}
    </div>
  );
}

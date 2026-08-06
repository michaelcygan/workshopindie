import type { Narrative } from "@/lib/analytics/narrative";

export function NarrativeList({ items }: { items: Narrative[] }) {
  if (!items.length) return null;
  return (
    <ul className="space-y-2 rounded-2xl border border-border bg-surface p-4">
      {items.map((n, i) => (
        <li key={i} className="flex gap-2 text-sm text-ink">
          <span
            aria-hidden
            className={
              n.tone === "up"
                ? "text-emerald-600"
                : n.tone === "down"
                  ? "text-amber-600"
                  : "text-ink-muted"
            }
          >
            {n.tone === "up" ? "▲" : n.tone === "down" ? "▼" : "•"}
          </span>
          <span>{n.text}</span>
        </li>
      ))}
    </ul>
  );
}

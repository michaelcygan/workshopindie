import { Link } from "@tanstack/react-router";

import type { Topic } from "@/lib/topics/topics";

/** Canonical Topic pills. Every Topic links to its hub. */
export function TopicChips({
  topics,
  max = 4,
  className = "",
}: {
  topics: Topic[] | null | undefined;
  max?: number;
  className?: string;
}) {
  const list = (topics ?? []).slice(0, max);
  if (list.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {list.map((t) => (
        <Link
          key={t.id}
          to="/topics/$slug"
          params={{ slug: t.slug }}
          className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-soft transition-colors hover:border-ink/40 hover:text-ink"
        >
          {t.name}
        </Link>
      ))}
    </div>
  );
}

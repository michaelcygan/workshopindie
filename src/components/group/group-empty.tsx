import type { ReactNode } from "react";

/**
 * Single shape for all empty-tab states on a Group page. Drives the first
 * action instead of bouncing to a global list.
 */
export function GroupEmpty({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mt-6 rounded-3xl border border-dashed border-border bg-surface p-10 text-center">
      <p className="font-display text-base text-ink">{title}</p>
      {hint && <p className="mt-1 text-sm text-ink-muted">{hint}</p>}
      {action && <div className="mt-4 inline-flex">{action}</div>}
    </div>
  );
}

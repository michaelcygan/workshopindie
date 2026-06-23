import { X } from "lucide-react";
import { useState, useEffect } from "react";

type Props = {
  /** Stable key: `nudge:<kind>:<entity-id>:<user-id>` — used for localStorage dismiss. */
  storageKey: string;
  icon?: React.ReactNode;
  title: string;
  description?: string;
  children?: React.ReactNode;
  tone?: "primary" | "neutral";
};

/**
 * Shared inline nudge card — small, dismissible, never modal. Reuses the
 * become-host-nudge visual language but is layout-flow (not fixed).
 *
 * Dismissal persists in localStorage under the provided key so the same
 * suggestion never nags the same user twice on the same entity.
 */
export function NudgeCard({ storageKey, icon, title, description, children, tone = "primary" }: Props) {
  // Start dismissed-by-default during SSR so we never render a nudge that
  // would immediately disappear on hydration.
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(!!window.localStorage.getItem(storageKey));
    } catch {
      setDismissed(false);
    }
  }, [storageKey]);

  if (dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // ignore quota / disabled storage
    }
  }

  const ring = tone === "primary" ? "border-primary/25 bg-primary/[0.04]" : "border-border bg-surface";

  return (
    <div className={`relative rounded-2xl border ${ring} p-4 shadow-soft`}>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-ink-muted hover:bg-muted hover:text-ink"
      >
        <X className="h-3 w-3" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        {icon && (
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-display text-base text-ink">{title}</p>
          {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
          {children && <div className="mt-3 flex flex-wrap items-center gap-2">{children}</div>}
        </div>
      </div>
    </div>
  );
}

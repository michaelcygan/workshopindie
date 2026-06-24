import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LinkCta = { label: string; to: string; params?: Record<string, string> };
type ClickCta = { label: string; onClick: () => void };

type Props = {
  icon?: LucideIcon;
  title: string;
  body?: string;
  cta?: LinkCta | ClickCta;
  className?: string;
};

/**
 * Canonical empty-state. Use everywhere instead of bespoke "nothing yet"
 * branches — keeps tone consistent and shrinks per-page code.
 */
export function EmptyState({ icon: Icon, title, body, cta, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-surface/50 px-6 py-10 text-center",
        className,
      )}
    >
      {Icon ? (
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-ink-muted">
          <Icon className="h-5 w-5" />
        </span>
      ) : null}
      <div className="space-y-1">
        <h3 className="font-display text-base text-ink">{title}</h3>
        {body ? <p className="max-w-sm text-sm text-ink-muted">{body}</p> : null}
      </div>
      {cta ? (
        "onClick" in cta ? (
          <Button size="sm" className="rounded-full" onClick={cta.onClick}>
            {cta.label}
          </Button>
        ) : (
          <Link to={cta.to as never} params={cta.params as never}>
            <Button size="sm" className="rounded-full">
              {cta.label}
            </Button>
          </Link>
        )
      ) : null}
    </div>
  );
}

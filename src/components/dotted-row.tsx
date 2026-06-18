import { cn } from "@/lib/utils";
import { LiveDot } from "@/components/live-dot";

type Props = {
  label: React.ReactNode;
  count?: number | string | null;
  live?: boolean;
  onClick?: () => void;
  href?: string;
  className?: string;
  meta?: React.ReactNode;
};

/**
 * A label · dotted leader · count row. Optional pulsing live dot on the left.
 * Use inside a <ul> of selectable topics/cities/groups.
 */
export function DottedRow({ label, count, live, onClick, className, meta }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-muted/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        className,
      )}
    >
      {(live !== undefined || live) && <LiveDot live={live} />}
      <span className="truncate text-[14px] font-medium text-ink">{label}</span>
      <span
        aria-hidden
        className="mx-1 flex-1 translate-y-[2px] border-b border-dotted border-ink/15"
      />
      {meta && <span className="text-[11px] text-ink-muted/80">{meta}</span>}
      {count !== undefined && count !== null && (
        <span
          className={cn(
            "tabular-nums text-[12px] font-semibold",
            live ? "text-primary" : "text-ink-muted/70",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  count: number;
  label?: string;
  className?: string;
};

/** Compact "X in the last 24h" stat chip. Renders nothing when count is 0. */
export function RecapChip({ count, label = "in the last 24h", className }: Props) {
  if (!count) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-ink-soft",
        className,
      )}
    >
      <Activity className="h-2.5 w-2.5" />
      {count.toLocaleString()} {label}
    </span>
  );
}

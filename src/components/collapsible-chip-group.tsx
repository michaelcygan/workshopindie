import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Label } from "@/components/ui/label";

/**
 * A chip group that collapses to roughly one row on mobile.
 *
 * Selected chips are hoisted to the front so a collapsed group never hides a
 * pick. Desktop starts expanded — space is fine there — but the header stays
 * tappable so a group can still be folded away.
 */
export function CollapsibleChipGroup<T extends string>({
  label,
  options,
  selected,
  onToggle,
  chipClassName,
  hint,
  labelSize = "label",
  collapsedCountMobile = 4,
  collapsedCountDesktop,
}: {
  label: string;
  options: readonly { id: T; label: string }[];
  selected: readonly T[];
  onToggle: (id: T) => void;
  /** Extra classes for a selected chip; defaults to the ink pill. */
  chipClassName?: (id: T) => string;
  hint?: ReactNode;
  labelSize?: "label" | "eyebrow";
  collapsedCountMobile?: number;
  collapsedCountDesktop?: number;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState<boolean | null>(null);

  const cap = isMobile ? collapsedCountMobile : (collapsedCountDesktop ?? options.length);
  const ordered = [
    ...options.filter((o) => selected.includes(o.id)),
    ...options.filter((o) => !selected.includes(o.id)),
  ];
  const collapsible = ordered.length > cap;
  const expanded = open ?? !isMobile;
  const visible = expanded || !collapsible ? ordered : ordered.slice(0, cap);
  const hidden = ordered.length - visible.length;
  const selectedCount = options.filter((o) => selected.includes(o.id)).length;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => collapsible && setOpen(!expanded)}
        className={cn("flex w-full items-center gap-1.5 text-left", !collapsible && "cursor-default")}
        aria-expanded={collapsible ? expanded : undefined}
      >
        {labelSize === "label" ? (
          <Label className="cursor-[inherit]">
            {label}
            {selectedCount > 0 && ` · ${selectedCount}`}
          </Label>
        ) : (
          <span className="text-xs uppercase tracking-wide text-ink-muted">
            {label}
            {selectedCount > 0 && ` · ${selectedCount}`}
          </span>
        )}
        {collapsible && (
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-ink-muted transition-transform",
              expanded && "rotate-180",
            )}
          />
        )}
      </button>

      <div className="flex flex-wrap gap-2">
        {visible.map((o) => {
          const on = selected.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onToggle(o.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition",
                on
                  ? cn("border-transparent", chipClassName?.(o.id) ?? "bg-ink text-background")
                  : "border-border bg-surface text-ink-soft hover:bg-muted",
              )}
            >
              {o.label}
            </button>
          );
        })}
        {collapsible && !expanded && hidden > 0 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-ink-muted transition hover:bg-muted hover:text-ink"
          >
            +{hidden} more
          </button>
        )}
      </div>

      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

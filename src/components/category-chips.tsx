import { CATEGORY_LABELS, categoryClass, type Category } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { CategoryChip } from "./category-chip";

/**
 * Renders a work / collab / workshop's category set: the primary chip is
 * always shown in its category color; any extras follow as neutral outline
 * chips. A Work can carry up to 3 categories total (e.g. a music video is
 * both Music and Film).
 */
export function CategoryChips({
  primary,
  categories,
  size = "sm",
  className,
  inline = false,
}: {
  primary: Category;
  /** Full categories array from the row, including the primary. */
  categories?: readonly Category[] | null;
  size?: "sm" | "md";
  className?: string;
  /** When true, extras render inline next to the primary chip (else wrapped). */
  inline?: boolean;
}) {
  const extras = (categories ?? [])
    .filter((c): c is Category => !!c && c !== primary)
    .slice(0, 2);

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", inline && "flex-nowrap", className)}>
      <CategoryChip category={primary} size={size} />
      {extras.map((c) => (
        <span
          key={c}
          className={cn(
            "inline-flex items-center rounded-full border font-medium",
            size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
            "border-border bg-surface text-ink-soft",
          )}
          title={`Also tagged ${CATEGORY_LABELS[c] ?? c}`}
        >
          {CATEGORY_LABELS[c] ?? c}
        </span>
      ))}
    </span>
  );
}

/** Compact form: primary chip + "+N" chip when there are extras. */
export function CategoryChipsCompact({
  primary,
  categories,
  size = "sm",
  className,
}: {
  primary: Category;
  categories?: readonly Category[] | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const extras = (categories ?? []).filter((c): c is Category => !!c && c !== primary);
  const extraCount = extras.length;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <CategoryChip category={primary} size={size} />
      {extraCount > 0 && (
        <span
          className={cn(
            "inline-flex items-center rounded-full border border-border bg-surface font-medium text-ink-soft",
            size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
          )}
          title={`Also tagged ${extras
            .map((c) => CATEGORY_LABELS[c] ?? c)
            .join(", ")}`}
        >
          +{extraCount}
        </span>
      )}
    </span>
  );
}

// Force categoryClass to be considered used for tree-shakers / linters that
// scan bare identifiers (kept for parity with sibling chip module).
void categoryClass;

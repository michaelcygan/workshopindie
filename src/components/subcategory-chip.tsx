import { subcategoryLabel, subcategoryForPrimary } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

/**
 * The specialization chip that sits beside a row's Field chips.
 *
 * A specialization is only meaningful under its parent Field, so this renders
 * nothing when the stored value doesn't belong to the primary Field passed in
 * (legacy rows, or a Field that changed after the fact).
 */
export function SubcategoryChip({
  subcategory,
  field,
  size = "sm",
  className,
}: {
  subcategory?: string | null;
  field?: string | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const id = field ? subcategoryForPrimary(subcategory ?? null, field) : (subcategory ?? null);
  if (!id) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-surface font-medium text-ink-soft",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        className,
      )}
      title="Specialization"
    >
      {subcategoryLabel(id)}
    </span>
  );
}

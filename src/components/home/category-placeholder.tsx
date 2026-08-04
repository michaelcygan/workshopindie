import { CATEGORY_LABELS, categoryClass, type Category } from "@/lib/categories";
import { cn } from "@/lib/utils";

/**
 * Typographic stand-in for entities with no cover image.
 * Sets the category label in the brand display face on the category's tint.
 */
export function CategoryPlaceholder({
  category,
  className,
}: {
  category: Category;
  className?: string;
}) {
  const label = CATEGORY_LABELS[category] ?? category;
  return (
    <div
      aria-hidden
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-md border border-border/70 px-1 text-center",
        categoryClass(category),
        className,
      )}
    >
      <span className="font-display text-[11px] leading-tight tracking-tight md:text-[13px]">
        {label}
      </span>
    </div>
  );
}

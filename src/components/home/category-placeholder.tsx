import type { Category } from "@/lib/categories";
import { categoryLabel } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

/**
 * Typographic stand-in for entities with no cover image.
 * Monochrome by design — the category label carries the meaning, not a tint.
 *
 * `size="tile"`  — small grid/list thumbnails (the original behaviour).
 * `size="cover"` — full-width 16:10 cover slots, where a bare grey block reads
 *                  as a broken image rather than as a deliberate absence.
 */
export function CategoryPlaceholder({
  category,
  className,
  size = "tile",
}: {
  category: Category | string | null | undefined;
  className?: string;
  size?: "tile" | "cover";
}) {
  const label = category
    ? (categoryLabel(category))
    : "No cover";

  return (
    <div
      aria-hidden
      className={cn(
        "flex items-center justify-center overflow-hidden border-border/70 bg-surface-2 text-center text-ink-muted",
        size === "tile" ? "rounded-md border px-1" : "px-6",
        className,
      )}
    >
      <span
        className={cn(
          "font-display leading-tight tracking-tight",
          size === "tile"
            ? "text-[11px] md:text-[13px]"
            : "text-[15px] uppercase tracking-[0.14em] md:text-[17px]",
        )}
      >
        {label}
      </span>
    </div>
  );
}


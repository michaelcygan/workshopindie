import { categoryClass, type Category } from "@/lib/categories";
import { cn } from "@/lib/utils";

export function CategoryChip({
  category,
  className,
  size = "sm",
}: {
  category: Category;
  className?: string;
  size?: "sm" | "md";
}) {
  const label = category.charAt(0).toUpperCase() + category.slice(1);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm",
        categoryClass(category),
        className,
      )}
    >
      {label}
    </span>
  );
}

import { Star } from "lucide-react";
import { toast } from "sonner";
import { WORK_CATEGORIES, categoryClass, type WorkCategory } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

/**
 * Multi-select category picker used by Works / Collab / Workshop compose flows.
 * A primary category is always required. Up to 2 extra categories can be added
 * (3 total). The primary drives cover color and share card; extras are shown
 * as neutral chips on cards and detail views.
 */
export function CategoryMultiPicker({
  label = "Categories",
  primary,
  onPrimaryChange,
  extras,
  onExtrasChange,
  onPrimaryReset,
  hint = "Tap to add up to 3. Star an extra to make it the primary — cover color and share card follow the primary.",
  max = 3,
}: {
  label?: string;
  primary: WorkCategory;
  onPrimaryChange: (next: WorkCategory) => void;
  extras: WorkCategory[];
  onExtrasChange: (next: WorkCategory[]) => void;
  /** Called when the primary changes so parents can clear a subtype tied to it. */
  onPrimaryReset?: () => void;
  hint?: string;
  max?: number;
}) {
  const extrasCap = Math.max(0, max - 1);

  function toggle(id: WorkCategory) {
    if (id === primary) {
      if (extras.length === 0) return;
      const [nextPrimary, ...rest] = extras;
      onPrimaryChange(nextPrimary);
      onExtrasChange(rest);
      onPrimaryReset?.();
      return;
    }
    if (extras.includes(id)) {
      onExtrasChange(extras.filter((x) => x !== id));
      return;
    }
    if (extras.length >= extrasCap) {
      toast.info(`Up to ${max} categories. Remove one first.`);
      return;
    }
    onExtrasChange([...extras, id]);
  }

  function promote(id: WorkCategory) {
    if (id === primary) return;
    const nextExtras = [primary, ...extras.filter((x) => x !== id)].slice(0, extrasCap);
    onPrimaryChange(id);
    onExtrasChange(nextExtras);
    onPrimaryReset?.();
  }

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label>{label}</Label>
        <span className="text-xs text-ink-muted">
          {1 + extras.length}/{max} · star to change primary
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {WORK_CATEGORIES.map((c) => {
          const id = c.id as WorkCategory;
          const isPrimary = primary === id;
          const isExtra = extras.includes(id);
          return (
            <span key={c.id} className="relative inline-flex">
              <button
                type="button"
                onClick={() => toggle(id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition",
                  isPrimary
                    ? cn("border-transparent pl-6", categoryClass(id))
                    : isExtra
                      ? cn("border-transparent pr-7", categoryClass(id), "opacity-90")
                      : "border-border bg-surface text-ink-soft hover:bg-muted",
                )}
              >
                {c.label}
              </button>
              {isPrimary && (
                <Star
                  className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 fill-current"
                  aria-label="Primary category"
                />
              )}
              {isExtra && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    promote(id);
                  }}
                  className="absolute right-1 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full text-current hover:bg-black/10"
                  aria-label={`Make ${c.label} the primary category`}
                  title="Make primary"
                >
                  <Star className="h-3 w-3" />
                </button>
              )}
            </span>
          );
        })}
      </div>
      <p className="text-xs text-ink-muted">{hint}</p>
    </section>
  );
}

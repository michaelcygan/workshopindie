import { Star } from "lucide-react";
import { toast } from "sonner";
import { FIELD_OPTIONS, fieldClass, normalizeField, type FieldId } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

/**
 * The one Field picker in the product.
 *
 * Fields are the shared disciplinary vocabulary (Music, Film & Video, …,
 * Software & AI, Science & Research). Specificity belongs in Format, Groups
 * and profile practices — never in more Fields, so this list never grows per
 * surface. Every primitive that classifies subject area uses this component.
 */
export function FieldPicker({
  label = "Field",
  primary,
  onPrimaryChange,
  extras,
  onExtrasChange,
  onPrimaryReset,
  hint = "Pick the field this belongs to. Add up to 3 — star one to lead with it.",
  options = FIELD_OPTIONS,
  max = 3,
}: {
  label?: string;
  primary: FieldId;
  onPrimaryChange: (next: FieldId) => void;
  extras: FieldId[];
  onExtrasChange: (next: FieldId[]) => void;
  /** Called when the primary changes so parents can clear a Format tied to it. */
  onPrimaryReset?: () => void;
  hint?: string;
  options?: readonly { id: FieldId; label: string }[];
  max?: number;
}) {
  const extrasCap = Math.max(0, max - 1);

  function toggle(id: FieldId) {
    if (id === primary) {
      if (extras.length === 0) return;
      const [nextPrimary, ...rest] = extras;
      onPrimaryChange(nextPrimary!);
      onExtrasChange(rest);
      onPrimaryReset?.();
      return;
    }
    if (extras.includes(id)) {
      onExtrasChange(extras.filter((x) => x !== id));
      return;
    }
    if (extras.length >= extrasCap) {
      toast.info(`Up to ${max} fields. Remove one first.`);
      return;
    }
    onExtrasChange([...extras, id]);
  }

  function promote(id: FieldId) {
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
        {options.map((c) => {
          const id = normalizeField(c.id);
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
                    ? cn("border-transparent pl-6", fieldClass(id))
                    : isExtra
                      ? cn("border-transparent pr-7", fieldClass(id), "opacity-90")
                      : "border-border bg-surface text-ink-soft hover:bg-muted",
                )}
              >
                {c.label}
              </button>
              {isPrimary && (
                <Star
                  className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 fill-current"
                  aria-label="Primary field"
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
                  aria-label={`Make ${c.label} the primary field`}
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

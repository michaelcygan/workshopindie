import { useMemo, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import {
  GENERAL_FIELD_ID,
  fieldLabel,
  normalizeField,
  subcategoriesForField,
  subcategoryLabel,
} from "@/lib/taxonomy";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { useIsMobile } from "@/hooks/use-mobile";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * The one subcategory picker.
 *
 * A subcategory is the optional specialization beneath the primary Field —
 * never a Field of its own, and never shown for General. It only ever offers
 * the children of the Field passed in, so an invalid pairing is unreachable
 * from the UI.
 */
export function SubcategoryPicker({
  field,
  value,
  onChange,
  label = "Specialization",
  hint = "Optional. Narrows the field for search and discovery.",
  placeholder = "Add a specialization",
}: {
  field: string | null | undefined;
  value: string | null;
  onChange: (next: string | null) => void;
  label?: string;
  hint?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const normalized = normalizeField(field);
  const options = subcategoriesForField(normalized);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  // General has no subcategories, by design.
  if (normalized === GENERAL_FIELD_ID || options.length === 0) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label>{label}</Label>
        <span className="text-xs text-ink-muted">Optional</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition",
                value
                  ? "border-transparent bg-muted text-ink"
                  : "border-border bg-surface text-ink-soft hover:bg-muted",
              )}
            >
              {value ? subcategoryLabel(value) : placeholder}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-0">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Search className="h-3.5 w-3.5 text-ink-muted" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search specializations"
                className="w-full bg-transparent text-sm outline-none placeholder:text-ink-muted"
              />
            </div>
            <ul className="max-h-72 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-ink-muted">No match.</li>
              ) : (
                filtered.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(o.id === value ? null : o.id);
                        setOpen(false);
                        setQuery("");
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      {o.label}
                      {o.id === value && <Check className="h-3.5 w-3.5" />}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </PopoverContent>
        </Popover>

        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      <p className="text-xs text-ink-muted">{hint}</p>
    </section>
  );
}

/**
 * Multi-select specialties for Profiles, grouped by the Fields the person
 * already claims. Caps and parent validation live in `normalizeSpecialties`.
 *
 * Each field group collapses to a single row of chips so the section stays
 * short on mobile; selected chips are always visible.
 */
export function SpecialtiesPicker({
  fields,
  value,
  onChange,
  max = 12,
  label = "Specialties",
}: {
  fields: readonly string[];
  value: readonly string[];
  onChange: (next: string[]) => void;
  max?: number;
  label?: string;
}) {
  const isMobile = useIsMobile();
  const [openFields, setOpenFields] = useState<Record<string, boolean>>({});

  const groups = fields
    .map((f) => normalizeField(f))
    .filter((f, i, arr) => f !== GENERAL_FIELD_ID && arr.indexOf(f) === i)
    .map((f) => ({ field: f, options: subcategoriesForField(f) }))
    .filter((g) => g.options.length > 0);

  if (groups.length === 0) return null;

  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
      return;
    }
    if (value.length >= max) return;
    onChange([...value, id]);
  }

  const collapsedCount = isMobile ? 4 : 6;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <Label>{label}</Label>
        <span className="text-xs text-ink-muted">
          {value.length}/{max} · optional
        </span>
      </div>
      {groups.map((g) => {
        // Selected first so a collapsed group never hides a pick.
        const ordered = [
          ...g.options.filter((o) => value.includes(o.id)),
          ...g.options.filter((o) => !value.includes(o.id)),
        ];
        const selectedCount = g.options.filter((o) => value.includes(o.id)).length;
        const expanded = openFields[g.field] ?? !isMobile;
        const collapsible = ordered.length > collapsedCount;
        const visible = expanded || !collapsible ? ordered : ordered.slice(0, collapsedCount);
        const hidden = ordered.length - visible.length;

        return (
          <div key={g.field} className="space-y-1.5">
            <button
              type="button"
              onClick={() =>
                collapsible && setOpenFields((p) => ({ ...p, [g.field]: !expanded }))
              }
              className={cn(
                "flex w-full items-center gap-1.5 text-left",
                !collapsible && "cursor-default",
              )}
              aria-expanded={collapsible ? expanded : undefined}
            >
              <span className="text-xs uppercase tracking-wide text-ink-muted">
                {fieldLabel(g.field)}
                {selectedCount > 0 && ` · ${selectedCount}`}
              </span>
              {collapsible && (
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-ink-muted transition-transform",
                    expanded && "rotate-180",
                  )}
                />
              )}
            </button>
            <div className="flex flex-wrap gap-1.5">
              {visible.map((o) => {
                const on = value.includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggle(o.id)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition",
                      on
                        ? "border-transparent bg-ink text-background"
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
                  onClick={() => setOpenFields((p) => ({ ...p, [g.field]: true }))}
                  className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-ink-muted transition hover:bg-muted hover:text-ink"
                >
                  +{hidden} more
                </button>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}


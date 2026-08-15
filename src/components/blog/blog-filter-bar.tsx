/**
 * Compact Blog filter bar: Post type · Field · Subject.
 *
 * Purely presentational — the owning route holds the filter state in its URL
 * search params so every filtered view is shareable.
 */
import { X } from "lucide-react";

export type BlogFilterValue = {
  type?: string;
  field?: string;
  subject?: string;
};

export type BlogFilterOption = { value: string; label: string };

const chip =
  "shrink-0 rounded-full border px-3 py-1 text-xs transition-colors";
const on = "border-ink bg-ink text-surface";
const off = "border-border bg-surface text-ink-soft hover:border-ink/40";

function Group({
  label,
  options,
  active,
  onPick,
}: {
  label: string;
  options: BlogFilterOption[];
  active?: string;
  onPick: (value: string | undefined) => void;
}) {
  if (options.length < 2) return null;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-ink-muted">
        {label}
      </span>
      <div className="flex gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {options.map((o) => {
          const isOn = active === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onPick(isOn ? undefined : o.value)}
              aria-pressed={isOn}
              className={`${chip} ${isOn ? on : off}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function BlogFilterBar({
  types,
  fields,
  subjects,
  value,
  onChange,
}: {
  types: BlogFilterOption[];
  fields: BlogFilterOption[];
  subjects: BlogFilterOption[];
  value: BlogFilterValue;
  onChange: (next: BlogFilterValue) => void;
}) {
  const hasAny = !!(value.type || value.field || value.subject);
  if (types.length < 2 && fields.length < 2 && subjects.length < 2 && !hasAny) return null;

  return (
    <div className="border-b border-border">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 md:flex-row md:flex-wrap md:items-center md:gap-5 md:px-6">
        <Group
          label="Type"
          options={types}
          active={value.type}
          onPick={(v) => onChange({ ...value, type: v })}
        />
        <Group
          label="Field"
          options={fields}
          active={value.field}
          onPick={(v) => onChange({ ...value, field: v })}
        />
        <Group
          label="Subject"
          options={subjects}
          active={value.subject}
          onPick={(v) => onChange({ ...value, subject: v })}
        />
        {hasAny ? (
          <button
            type="button"
            onClick={() => onChange({})}
            className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-muted underline decoration-border underline-offset-4 hover:text-ink"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

import { useState } from "react";
import { Plus, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeTags } from "@/lib/entity-tags";

/**
 * Entity-neutral free-tag editor: chips + free entry + suggestions.
 *
 * Shared by Work (Subject, Material) and Blog (Subject). It knows nothing about
 * the primitive it edits — the caller supplies the label, suggestions, and cap.
 */
export function TagField({
  label,
  help,
  values,
  onChange,
  suggestions,
  max,
  placeholder,
  disabled,
}: {
  label: string;
  help?: string;
  values: string[];
  onChange: (v: string[]) => void;
  suggestions: string[];
  max: number;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    onChange(normalizeTags([...values, raw], max));
    setDraft("");
  };
  const remaining = suggestions.filter(
    (s) => !values.some((v) => v.toLowerCase() === s.toLowerCase()),
  );

  return (
    <div className="space-y-2">
      {label ? <Label>{label}</Label> : null}
      {help && <p className="text-xs text-ink-muted">{help}</p>}
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-ink"
            >
              {v}
              {!disabled && (
                <button
                  type="button"
                  aria-label={`Remove ${v}`}
                  onClick={() => onChange(values.filter((x) => x !== v))}
                  className="text-ink-muted hover:text-ink"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {!disabled && values.length < max && (
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (draft.trim()) add(draft);
              }
            }}
            placeholder={placeholder ?? "Add another…"}
            className="h-9"
          />
          <button
            type="button"
            onClick={() => draft.trim() && add(draft)}
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md border border-border bg-surface px-3 text-xs text-ink-soft hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
      )}
      {!disabled && values.length < max && remaining.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {remaining.slice(0, 10).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-ink-muted hover:bg-muted hover:text-ink"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { formatSuggestionsFor } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

export const MAX_FORMAT_LEN = 40;

/**
 * Format = what kind of thing this is (Album, Short film, Dataset, Prototype).
 *
 * Formats are open text with per-Field suggestions, deliberately NOT an enum:
 * new disciplines arrive constantly and adding a Field for each one is what
 * this migration exists to stop.
 */
export function FormatInput({
  label = "Format",
  fields,
  value,
  onChange,
  placeholder = "Album, short film, dataset, prototype…",
  hint = "Optional. Pick a suggestion or type your own.",
}: {
  label?: string;
  fields: readonly string[];
  value: string | null;
  onChange: (next: string | null) => void;
  placeholder?: string;
  hint?: string;
}) {
  const [custom, setCustom] = useState(false);
  const suggestions = formatSuggestionsFor(fields);
  const isSuggested = !!value && suggestions.includes(value);
  const showInput = custom || (!!value && !isSuggested);

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label>{label}</Label>
        <button
          type="button"
          onClick={() => setCustom((c) => !c)}
          className="text-xs text-ink-muted underline-offset-2 hover:underline"
        >
          {showInput ? "Use a suggestion" : "Write your own"}
        </button>
      </div>

      {showInput ? (
        <Input
          value={value ?? ""}
          maxLength={MAX_FORMAT_LEN}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value.slice(0, MAX_FORMAT_LEN) || null)}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange(value === s ? null : s)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition",
                value === s
                  ? "border-ink bg-ink text-surface"
                  : "border-border bg-surface text-ink-soft hover:bg-muted",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <p className="text-xs text-ink-muted">{hint}</p>
    </section>
  );
}

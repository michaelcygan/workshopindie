import * as React from "react";
import { Check, ChevronDown, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { FILTER_PILL } from "./index";

export type FilterCityOption = {
  /** Stable value written to the URL — usually the city name. */
  value: string;
  label: string;
  /** Optional trailing count (members, events…). */
  count?: number;
  hint?: string | null;
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

function letterOf(label: string) {
  const c = label.trim().charAt(0).toLocaleUpperCase();
  return /[A-Z]/.test(c) ? c : "#";
}

/**
 * City filter built for long lists: type-to-filter, A–Z quick-skip rail, and
 * letter-grouped rows. Shared primitive so Groups, Events and Collabs can all
 * use the same control.
 */
export function FilterCityPicker({
  value,
  onChange,
  options,
  label = "Filter by city",
  allLabel = "All cities",
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  options: FilterCityOption[];
  label?: string;
  allLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const matches = React.useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const rows = q
      ? options.filter(
          (o) =>
            o.label.toLocaleLowerCase().includes(q) ||
            (o.hint ?? "").toLocaleLowerCase().includes(q),
        )
      : options;
    return rows
      .slice()
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  }, [options, query]);

  const groups = React.useMemo(() => {
    const map = new Map<string, FilterCityOption[]>();
    for (const o of matches) {
      const l = letterOf(o.label);
      const bucket = map.get(l);
      if (bucket) bucket.push(o);
      else map.set(l, [o]);
    }
    return map;
  }, [matches]);

  const jump = (letter: string) => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-letter="${letter}"]`);
    el?.scrollIntoView({ block: "start" });
  };

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={wrapRef} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          FILTER_PILL,
          "inline-flex min-w-[11rem] items-center justify-between gap-2 whitespace-nowrap",
          selected && "border-transparent bg-ink text-background hover:border-transparent",
        )}
      >
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{selected ? selected.label : allLabel}</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
      </button>

      {open ? (
        <div className="absolute left-0 z-50 mt-2 w-[19rem] overflow-hidden rounded-2xl border border-border bg-surface shadow-lift">
          <div className="border-b border-border p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cities…"
              aria-label="Search cities"
              className="h-9 w-full rounded-full border border-border bg-background px-3 text-[13px] text-ink placeholder:text-ink-muted/70 focus:border-ink/50 focus:outline-none"
            />
          </div>

          <div className="relative flex">
            <div ref={listRef} className="max-h-[18rem] min-w-0 flex-1 overflow-y-auto py-1">
              <Row
                label={allLabel}
                active={!value}
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              />
              {matches.length === 0 ? (
                <p className="px-3 py-6 text-center text-[13px] text-ink-muted">No cities match.</p>
              ) : (
                Array.from(groups.entries()).map(([letter, rows]) => (
                  <div key={letter} data-letter={letter}>
                    <p className="sticky top-0 bg-surface/95 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted backdrop-blur">
                      {letter}
                    </p>
                    {rows.map((o) => (
                      <Row
                        key={o.value}
                        label={o.label}
                        hint={o.hint}
                        count={o.count}
                        active={o.value === value}
                        onClick={() => {
                          onChange(o.value === value ? "" : o.value);
                          setOpen(false);
                        }}
                      />
                    ))}
                  </div>
                ))
              )}
            </div>

            <div className="flex w-6 shrink-0 flex-col items-center justify-start gap-px border-l border-border py-1">
              {LETTERS.map((l) => {
                const has = groups.has(l);
                return (
                  <button
                    key={l}
                    type="button"
                    disabled={!has}
                    onClick={() => jump(l)}
                    aria-label={`Jump to ${l}`}
                    className={cn(
                      "text-[9px] leading-[1.05] transition-colors",
                      has ? "text-ink-soft hover:text-ink" : "text-ink-muted/30",
                    )}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({
  label,
  hint,
  count,
  active,
  onClick,
}: {
  label: string;
  hint?: string | null;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-muted",
        active ? "text-ink" : "text-ink-soft",
      )}
    >
      <Check className={cn("h-3.5 w-3.5 shrink-0", active ? "opacity-100" : "opacity-0")} />
      <span className="min-w-0 flex-1 truncate">
        {label}
        {hint ? <span className="ml-1.5 text-ink-muted">{hint}</span> : null}
      </span>
      {typeof count === "number" && count > 0 ? (
        <span className="shrink-0 text-[11px] tabular-nums text-ink-muted">
          {count.toLocaleString()}
        </span>
      ) : null}
    </button>
  );
}

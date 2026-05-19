import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Search, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type CityOption = {
  id: string;
  name: string;
  slug: string;
  country: string;
  count: number;
};

export function GalleryCityFilter({
  cities,
  value, // city slug or "all"
  onChange,
  className,
}: {
  cities: CityOption[];
  value: string;
  onChange: (slug: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (open) {
      // Focus the input when popover opens
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setQuery("");
    }
  }, [open]);

  const selected = value === "all" ? null : cities.find((c) => c.slug === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? cities.filter(
          (c) =>
            c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q),
        )
      : cities;
    return list.slice(0, 50);
  }, [cities, query]);

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-9 items-center gap-2 rounded-full border px-3 text-sm shadow-soft transition",
          selected
            ? "border-ink bg-ink text-background"
            : "border-border bg-surface text-ink-soft hover:bg-muted",
        )}
      >
        <MapPin className="h-4 w-4" />
        <span className="max-w-[10rem] truncate">
          {selected ? selected.name : "Anywhere"}
        </span>
        {selected ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange("all");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onChange("all");
              }
            }}
            aria-label="Clear location"
            className="-mr-1 rounded-full p-0.5 hover:bg-background/20"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        ) : (
          <ChevronDown className="h-4 w-4 opacity-70" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1.5 w-80 overflow-hidden rounded-xl border border-border bg-popover shadow-lift">
          <div className="relative border-b border-border">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cities…"
              className="h-10 w-full bg-transparent pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted focus:outline-none"
            />
          </div>
          <ul className="max-h-72 overflow-auto py-1">
            <li>
              <button
                type="button"
                onClick={() => {
                  onChange("all");
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-muted",
                  value === "all" && "bg-muted",
                )}
              >
                <MapPin className="h-4 w-4 text-ink-muted" />
                <span className="flex-1">Anywhere</span>
              </button>
            </li>
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-ink-muted">
                No matching cities yet.
              </li>
            ) : (
              filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(c.slug);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-muted",
                      value === c.slug && "bg-muted",
                    )}
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{c.name}</span>
                      <span className="block truncate text-xs text-ink-muted">
                        {c.country}
                      </span>
                    </span>
                    <span className="self-center text-xs text-ink-muted">{c.count}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
          <div className="border-t border-border bg-surface px-3 py-1.5 text-[10px] text-ink-muted">
            Cities with published works
          </div>
        </div>
      )}
    </div>
  );
}

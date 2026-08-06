import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MapPin, Search, X } from "lucide-react";
import { searchLocations, type LocationOption } from "@/lib/geo/locations.functions";
import { cn } from "@/lib/utils";

export type SelectedLocation = {
  cityId: string | null;
  providerId: string | null;
  name: string;
  sublabel: string;
};

/**
 * Worldwide location picker. Ranks localities Workshop already has first, then
 * real places anywhere in the world. Typing never creates anything — a place is
 * only added to Workshop when the caller acts on an explicit selection.
 */
export function GlobalLocationCombobox({
  value,
  onSelect,
  onClear,
  disabled,
  busy,
  placeholder = "Search any city or town",
  className,
}: {
  value: SelectedLocation | null;
  onSelect: (option: SelectedLocation) => void;
  onClear?: () => void;
  disabled?: boolean;
  busy?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const search = useServerFn(searchLocations);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 280);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ["location-search", debounced],
    queryFn: () => search({ data: { q: debounced } }),
    enabled: open && !disabled,
    staleTime: 60_000,
  });

  const options = useMemo<LocationOption[]>(() => data?.options ?? [], [data]);

  return (
    <div ref={wrapRef} className={cn("relative", disabled && "opacity-60", className)}>
      <div className="flex h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 shadow-soft transition focus-within:shadow-lift">
        {busy ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-muted" />
        ) : (
          <Search className="h-4 w-4 shrink-0 text-ink-muted" />
        )}
        {value ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpen(true)}
            className="flex flex-1 items-center gap-1.5 truncate text-left text-sm text-ink"
          >
            <MapPin className="h-3.5 w-3.5 shrink-0 text-ink-soft" />
            <span className="truncate">{value.name}</span>
            {value.sublabel && (
              <span className="truncate text-xs text-ink-muted">· {value.sublabel}</span>
            )}
          </button>
        ) : (
          <input
            type="text"
            value={query}
            disabled={disabled}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-muted/70 focus:outline-none"
          />
        )}
        {(value || query) && !disabled && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setOpen(false);
              onClear?.();
            }}
            className="rounded-full p-1 text-ink-muted transition hover:bg-muted hover:text-ink"
            aria-label="Clear location"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && !disabled && (
        <div className="absolute left-0 right-0 z-30 mt-2 max-h-72 overflow-auto rounded-2xl border border-border bg-surface p-1 shadow-lift">
          {isFetching && options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-ink-muted">Searching…</div>
          ) : options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-ink-muted">
              {debounced.length < 2 ? "Type a city or town." : "No places match."}
            </div>
          ) : (
            options.map((o) => (
              <button
                key={o.cityId ?? o.providerId ?? o.name}
                type="button"
                onClick={() => {
                  setOpen(false);
                  setQuery("");
                  onSelect({
                    cityId: o.cityId,
                    providerId: o.providerId,
                    name: o.name,
                    sublabel: o.sublabel,
                  });
                }}
                className="flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-muted"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-ink">{o.name}</span>
                  {o.sublabel && (
                    <span className="block truncate text-xs text-ink-muted">{o.sublabel}</span>
                  )}
                </span>
                {o.existing && (
                  <span className="mt-0.5 shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-soft">
                    On Workshop
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

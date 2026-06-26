import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Shared city search combobox. Used by Collab Board, Events, etc.
 * h-11 pill input; opens a result list pulled from `public.cities`.
 */
export function CityCombobox({
  value,
  valueLabel,
  onChange,
  disabled,
  placeholder = "Search by city — or leave for anywhere",
}: {
  value?: string;
  valueLabel?: string;
  onChange: (next: { id?: string; name?: string }) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  type CityRow = { id: string; name: string; country: string };
  const { data: cities } = useQuery<CityRow[]>({
    queryKey: ["city-combobox-search", query],
    queryFn: async () => {
      const base = supabase.from("cities").select("id,name,country").order("name").limit(8);
      const { data } = query.trim()
        ? await base.ilike("name", `%${query.trim()}%`)
        : await base;
      return (data ?? []) as CityRow[];
    },
    enabled: open && !disabled,
    staleTime: 30_000,
  });

  return (
    <div ref={wrapRef} className={cn("relative flex-1 min-w-[16rem]", disabled && "opacity-50")}>
      <div
        className={cn(
          "flex h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 shadow-soft transition focus-within:shadow-lift",
          disabled && "pointer-events-none",
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-ink-muted" />
        {value ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex flex-1 items-center gap-1.5 truncate text-left text-sm text-ink"
          >
            <MapPin className="h-3.5 w-3.5 text-ink-soft" />
            <span className="truncate">{valueLabel ?? "Selected city"}</span>
          </button>
        ) : (
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-muted/70 focus:outline-none"
            disabled={disabled}
          />
        )}
        {(value || query) && !disabled && (
          <button
            type="button"
            onClick={() => { onChange({ id: undefined, name: undefined }); setQuery(""); setOpen(false); }}
            className="rounded-full p-1 text-ink-muted hover:bg-muted hover:text-ink"
            aria-label="Clear city"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && !disabled && !value && (
        <div className="absolute left-0 right-0 z-20 mt-2 max-h-72 overflow-auto rounded-2xl border border-border bg-surface p-1 shadow-lift">
          {(cities ?? []).length === 0 ? (
            <div className="px-3 py-2 text-sm text-ink-muted">No cities match.</div>
          ) : (
            (cities ?? []).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { onChange({ id: c.id, name: c.name }); setOpen(false); setQuery(""); }}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-ink hover:bg-muted"
              >
                <span className="truncate">{c.name}</span>
                <span className="ml-3 shrink-0 text-xs text-ink-muted">{c.country}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

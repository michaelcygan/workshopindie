import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2, X, Search } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { resolveCityFromOSM } from "@/lib/cities.functions";
import { cn } from "@/lib/utils";

export type CityValue = {
  id: string;
  name: string;
  country: string;
};

type PhotonProps = {
  name?: string;
  city?: string;
  town?: string;
  village?: string;
  state?: string;
  country?: string;
  countrycode?: string;
};
type PhotonFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: PhotonProps;
};

const cache = new Map<string, PhotonFeature[]>();

function featureCityName(p: PhotonProps): string {
  return p.name || p.city || p.town || p.village || p.state || p.country || "Unknown";
}

export function CityCombobox({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: CityValue | null;
  onChange: (v: CityValue | null) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const resolveCity = useServerFn(resolveCityFromOSM);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PhotonFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [open, setOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    if (cache.has(q)) {
      setResults(cache.get(q)!);
      setOpen(true);
      return;
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const r = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en&osm_tag=place:city&osm_tag=place:town&osm_tag=place:village`,
          { signal: ctrl.signal },
        );
        if (!r.ok) throw new Error("search failed");
        const j = (await r.json()) as { features: PhotonFeature[] };
        const feats = j.features ?? [];
        cache.set(q, feats);
        setResults(feats);
        setOpen(true);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function pickFeature(f: PhotonFeature) {
    const p = f.properties;
    const [lng, lat] = f.geometry.coordinates;
    setResolving(true);
    try {
      const city = await resolveCity({
        data: {
          name: featureCityName(p),
          state_region: p.state ?? null,
          country: p.country ?? "Unknown",
          country_code: p.countrycode ?? null,
          lat: typeof lat === "number" ? lat : null,
          lng: typeof lng === "number" ? lng : null,
        },
      });
      onChange(city);
      setOpen(false);
      setQuery("");
    } catch {
      // swallow; combobox stays open
    } finally {
      setResolving(false);
    }
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
        <MapPin className="h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-ink">{value.name}</div>
          <div className="truncate text-xs text-ink-muted">{value.country}</div>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="rounded-full p-1 text-ink-muted hover:bg-muted hover:text-ink"
          aria-label="Change city"
          disabled={disabled}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className={cn("relative", disabled && "opacity-50")}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
        <input
          type="text"
          className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-9 text-sm text-ink placeholder:text-ink-muted/70 focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder={placeholder ?? "Search any city in the world"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          disabled={disabled || resolving}
          autoComplete="off"
        />
        {(loading || resolving) && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-muted" />
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lift">
          <ul className="max-h-72 overflow-auto py-1">
            {results.map((f, i) => {
              const p = f.properties;
              const name = featureCityName(p);
              const sub = [p.state, p.country].filter(Boolean).join(", ");
              return (
                <li key={`${name}-${i}`}>
                  <button
                    type="button"
                    onClick={() => pickFeature(f)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-muted"
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{name}</span>
                      <span className="block truncate text-xs text-ink-muted">{sub}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-border bg-surface px-3 py-1.5 text-[10px] text-ink-muted">
            Cities from OpenStreetMap · Photon
          </div>
        </div>
      )}
    </div>
  );
}

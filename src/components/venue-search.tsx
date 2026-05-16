import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SelectedVenue = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  osm_ref: string | null;
  city: {
    name: string;
    state_region: string | null;
    country: string;
    country_code: string | null;
    lat: number | null;
    lng: number | null;
  };
};

type PhotonProps = {
  name?: string;
  street?: string;
  housenumber?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  country?: string;
  countrycode?: string;
  postcode?: string;
  osm_type?: string;
  osm_id?: number;
  type?: string;
};

type PhotonFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: PhotonProps;
};

function formatAddress(p: PhotonProps) {
  const street = [p.housenumber, p.street].filter(Boolean).join(" ");
  const city = p.city || p.town || p.village || p.county || "";
  const parts = [street, city, p.state, p.country].filter(Boolean);
  return parts.join(", ");
}

function featureToVenue(f: PhotonFeature): SelectedVenue {
  const p = f.properties;
  const [lng, lat] = f.geometry.coordinates;
  const cityName = p.city || p.town || p.village || p.county || p.state || p.country || "Unknown";
  return {
    name: p.name || formatAddress(p) || cityName,
    address: formatAddress(p),
    lat,
    lng,
    osm_ref: p.osm_type && p.osm_id ? `${p.osm_type}:${p.osm_id}` : null,
    city: {
      name: cityName,
      state_region: p.state ?? null,
      country: p.country ?? "Unknown",
      country_code: p.countrycode ?? null,
      lat: null,
      lng: null,
    },
  };
}

const cache = new Map<string, PhotonFeature[]>();

export function VenueSearch({
  value,
  onChange,
  placeholder,
}: {
  value: SelectedVenue | null;
  onChange: (v: SelectedVenue | null) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PhotonFeature[]>([]);
  const [loading, setLoading] = useState(false);
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
          `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en`,
          { signal: ctrl.signal },
        );
        if (!r.ok) throw new Error("search failed");
        const j = (await r.json()) as { features: PhotonFeature[] };
        const feats = j.features ?? [];
        cache.set(q, feats);
        setResults(feats);
        setOpen(true);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, value]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  if (value) {
    return (
      <div className="rounded-xl border border-border bg-surface p-3">
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-ink">{value.name}</div>
            <div className="truncate text-xs text-ink-muted">{value.address}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQuery("");
              setResults([]);
            }}
            className="rounded-full p-1 text-ink-muted hover:bg-muted hover:text-ink"
            aria-label="Change venue"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
        <Input
          className="pl-9"
          placeholder={placeholder ?? "Search a venue, address, or place"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-muted" />
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lift">
          <ul className="max-h-72 overflow-auto py-1">
            {results.map((f, i) => {
              const v = featureToVenue(f);
              const sub = [v.city.name, v.city.state_region, v.city.country].filter(Boolean).join(", ");
              return (
                <li key={`${v.osm_ref ?? i}-${i}`}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(v);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={cn(
                      "flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-muted",
                    )}
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{v.name}</span>
                      <span className="block truncate text-xs text-ink-muted">{sub}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-border bg-surface px-3 py-1.5 text-[10px] text-ink-muted">
            Results from OpenStreetMap · Photon
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  namedetails?: { name?: string };
  address?: Record<string, string>;
};

function formatAddress(addr?: Record<string, string>): string {
  if (!addr) return "";
  const line1 = [addr.house_number, addr.road].filter(Boolean).join(" ");
  const line2 = [addr.city ?? addr.town ?? addr.village ?? addr.hamlet, addr.state, addr.postcode]
    .filter(Boolean)
    .join(", ");
  return [line1, line2].filter(Boolean).join(", ");
}

function shortName(r: NominatimResult): string {
  return (
    r.namedetails?.name ||
    r.name ||
    r.display_name.split(",")[0]?.trim() ||
    r.display_name
  );
}

export function VenueAutocomplete({
  venueName,
  venueAddress,
  onChange,
}: {
  venueName: string;
  venueAddress: string;
  onChange: (next: { venue_name: string; venue_address: string }) => void;
}) {
  const [query, setQuery] = useState(venueName);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const skipSearchRef = useRef(false);

  useEffect(() => {
    // Sync when parent resets (e.g. dialog reopens)
    setQuery(venueName);
  }, [venueName]);

  useEffect(() => {
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return;
    }
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const url = new URL("https://nominatim.openstreetmap.org/search");
        url.searchParams.set("q", q);
        url.searchParams.set("format", "json");
        url.searchParams.set("addressdetails", "1");
        url.searchParams.set("namedetails", "1");
        url.searchParams.set("limit", "6");
        const res = await fetch(url.toString(), {
          signal: ctrl.signal,
          headers: { "Accept-Language": navigator.language || "en" },
        });
        if (!res.ok) throw new Error("search failed");
        const data = (await res.json()) as NominatimResult[];
        setResults(data);
        setOpen(true);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  function pick(r: NominatimResult) {
    const name = shortName(r);
    const address = formatAddress(r.address) || r.display_name;
    skipSearchRef.current = true;
    setQuery(name);
    setResults([]);
    setOpen(false);
    onChange({ venue_name: name, venue_address: address });
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Label>Venue</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              onChange({ venue_name: e.target.value, venue_address: venueAddress });
            }}
            onFocus={() => results.length > 0 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Search a bar, café, venue, or address…"
            className="pl-9 rounded-xl"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-muted" />
          )}
        </div>
        {open && results.length > 0 && (
          <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
            <ul className="max-h-64 overflow-y-auto text-sm">
              {results.map((r) => (
                <li key={r.place_id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(r);
                    }}
                    className={cn(
                      "flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-muted",
                    )}
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <div className="truncate font-medium text-ink">{shortName(r)}</div>
                      <div className="truncate text-[11px] text-ink-muted">
                        {formatAddress(r.address) || r.display_name}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <div className="border-t border-border bg-muted/40 px-3 py-1 text-[10px] text-ink-muted">
              Powered by OpenStreetMap
            </div>
          </div>
        )}
      </div>
      <div>
        <Label className="text-xs text-ink-muted">Address</Label>
        <Input
          value={venueAddress}
          onChange={(e) => onChange({ venue_name: venueName, venue_address: e.target.value })}
          placeholder="Street, city, state"
          className="rounded-xl"
        />
      </div>
    </div>
  );
}

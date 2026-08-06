import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { searchLocations, type LocationOption } from "@/lib/geo/locations.functions";
import { Input } from "@/components/ui/input";

/**
 * Shared admin picker. `mode="existing"` lists only localities Workshop already
 * has (merge targets); `mode="new"` lists places not yet on Workshop (launch queue).
 */
export function LocalitySearch({
  mode,
  placeholder,
  onPick,
}: {
  mode: "existing" | "new";
  placeholder: string;
  onPick: (option: LocationOption) => void;
}) {
  const search = useServerFn(searchLocations);
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await search({ data: { q: term } });
        if (cancelled) return;
        setOptions(res.options.filter((o) => (mode === "existing" ? o.existing : !o.existing)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, mode, search]);

  return (
    <div className="space-y-2">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} />
      {loading ? <div className="text-xs text-ink-muted">Searching…</div> : null}
      {options.length > 0 ? (
        <ul className="max-h-56 overflow-auto rounded-xl border border-border bg-surface">
          {options.map((o) => (
            <li key={`${o.cityId ?? o.providerId}`}>
              <button
                type="button"
                onClick={() => {
                  onPick(o);
                  setQ("");
                  setOptions([]);
                }}
                className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60"
              >
                <span className="text-ink">{o.name}</span>
                <span className="text-xs text-ink-muted">{o.sublabel}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

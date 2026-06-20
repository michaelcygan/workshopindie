import { useEffect, useRef, useState } from "react";
import { Search, X, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type CoCreator = {
  user_id: string | null;
  display_name: string;
  username?: string | null;
};

export function CoCreatorPicker({
  value,
  onChange,
  max = 8,
  excludeUserIds = [],
}: {
  value: CoCreator[];
  onChange: (next: CoCreator[]) => void;
  max?: number;
  excludeUserIds?: string[];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<CoCreator[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); return; }
    let cancel = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,display_name,username")
        .or(`display_name.ilike.%${q}%,username.ilike.%${q}%`)
        .limit(8);
      if (cancel) return;
      const taken = new Set([
        ...excludeUserIds,
        ...value.map((v) => v.user_id).filter(Boolean) as string[],
      ]);
      setResults(
        (data ?? [])
          .filter((p) => !taken.has(p.id))
          .map((p) => ({
            user_id: p.id,
            display_name: p.display_name ?? p.username ?? "Untitled",
            username: p.username,
          })),
      );
      setLoading(false);
    }, 220);
    return () => { cancel = true; clearTimeout(t); };
  }, [query, value, excludeUserIds]);

  const atMax = value.length >= max;

  function add(c: CoCreator) {
    if (atMax) return;
    onChange([...value, c]);
    setQuery("");
    setResults([]);
  }
  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }
  function addPlainName() {
    const name = query.trim();
    if (!name || atMax) return;
    add({ user_id: null, display_name: name });
  }

  return (
    <div className="space-y-2" ref={ref}>
      <div className="flex items-center justify-between">
        <Label>Co-creators</Label>
        <span className="text-xs text-ink-muted">{value.length}/{max}</span>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((c, i) => (
            <span
              key={`${c.user_id ?? "name"}-${i}`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm",
                c.user_id ? "border-border bg-surface text-ink" : "border-dashed border-border bg-background text-ink-soft",
              )}
            >
              {c.display_name}
              {!c.user_id && <span className="text-[10px] uppercase tracking-wide text-ink-muted">name</span>}
              <button
                type="button"
                onClick={() => remove(i)}
                className="rounded-full p-0.5 hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={atMax ? "Limit reached" : "Search people, or type a name"}
          disabled={atMax}
          className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm disabled:opacity-50"
        />
        {open && (results.length > 0 || query.trim()) && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lift">
            {loading && <div className="px-3 py-2 text-xs text-ink-muted">Searching…</div>}
            {results.map((r) => (
              <button
                key={r.user_id ?? r.display_name}
                type="button"
                onClick={() => add(r)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span className="truncate text-ink">{r.display_name}</span>
                {r.username && <span className="shrink-0 text-xs text-ink-muted">@{r.username}</span>}
              </button>
            ))}
            {query.trim() && !loading && (
              <button
                type="button"
                onClick={addPlainName}
                className="flex w-full items-center gap-2 border-t border-border bg-background px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <UserPlus className="h-4 w-4 text-ink-muted" />
                <span className="text-ink-soft">Add as name: </span>
                <span className="text-ink font-medium">"{query.trim()}"</span>
              </button>
            )}
          </div>
        )}
      </div>
      <p className="text-xs text-ink-muted">
        Tag people on Workshop, or just type a name if they're not here.
      </p>
    </div>
  );
}

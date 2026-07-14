import { useMemo } from "react";
import { ArrowUp, ArrowDown, X, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryChip } from "@/components/category-chip";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/categories";

const MAX_PINNED = 6;

export type PinnableWork = {
  id: string;
  title: string;
  slug: string;
  category: Category;
  cover_url: string | null;
};

export function PinnedWorksPicker({
  works,
  value,
  onChange,
  loading,
}: {
  works: PinnableWork[];
  value: string[];
  onChange: (next: string[]) => void;
  loading?: boolean;
}) {
  const byId = useMemo(() => new Map(works.map((w) => [w.id, w])), [works]);
  // Drop pinned IDs that no longer correspond to a published work the user owns.
  const validValue = value.filter((id) => byId.has(id));
  const ordered = validValue.map((id) => byId.get(id)!).filter(Boolean);
  const unpicked = works.filter((w) => !validValue.includes(w.id));

  const toggle = (id: string) => {
    if (validValue.includes(id)) {
      onChange(validValue.filter((x) => x !== id));
    } else if (validValue.length < MAX_PINNED) {
      onChange([...validValue, id]);
    }
  };
  const move = (i: number, dir: -1 | 1) => {
    const next = [...validValue];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  if (loading) {
    return <div className="h-32 animate-pulse rounded-2xl bg-surface-2" />;
  }

  if (works.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center text-sm text-ink-muted">
        Post to Gallery first — once you do, pin up to {MAX_PINNED} to feature them at the top of your profile.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Selected, ordered */}
      {ordered.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-muted">{ordered.length} of {MAX_PINNED} pinned · drag order with the arrows</p>
          </div>
          <ol className="space-y-2">
            {ordered.map((w, i) => (
              <li key={w.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-background">{i + 1}</span>
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-surface-2">
                  {w.cover_url && <img src={w.cover_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{w.title}</p>
                  <div className="mt-0.5"><CategoryChip category={w.category} /></div>
                </div>
                <div className="flex items-center gap-0.5">
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={i === ordered.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggle(w.id)} aria-label="Remove pin">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Picker grid */}
      {unpicked.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-ink-muted">
            {ordered.length === 0 ? `Pick up to ${MAX_PINNED}` : `Add more (${MAX_PINNED - ordered.length} left)`}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {unpicked.map((w) => {
              const full = ordered.length >= MAX_PINNED;
              return (
                <button
                  key={w.id}
                  type="button"
                  disabled={full}
                  onClick={() => toggle(w.id)}
                  className={cn(
                    "group relative overflow-hidden rounded-xl border border-border bg-surface text-left transition",
                    full ? "cursor-not-allowed opacity-50" : "hover:shadow-soft hover:border-ink/20",
                  )}
                >
                  <div className="aspect-[4/3] bg-surface-2">
                    {w.cover_url && <img src={w.cover_url} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="absolute right-1.5 top-1.5">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-ink shadow-soft backdrop-blur transition group-hover:bg-ink group-hover:text-background">
                      <Pin className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <div className="p-2">
                    <p className="truncate text-xs font-medium text-ink">{w.title}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

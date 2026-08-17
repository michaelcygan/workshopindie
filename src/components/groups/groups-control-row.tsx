import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import {
  useAllPublicGroups,
  type DirectoryState,
  type GroupsSort,
  SORT_VALUES,
} from "@/components/groups/groups-directory";
import { categoryLabel, normalizeCategory } from "@/lib/taxonomy";

const SORT_LABELS: Record<GroupsSort, string> = {
  featured: "Featured",
  members: "Most members",
  content: "Most content",
  az: "A–Z",
};

const PILL =
  "h-10 shrink-0 rounded-full border border-border bg-surface px-3.5 text-[13px] text-ink-soft outline-none transition-colors hover:border-ink/40 focus:border-ink/50";

/** True when the page should drop its editorial sections and show results. */
export function isDirectoryFiltered(state: DirectoryState): boolean {
  return (
    state.tab !== "all" ||
    (state.category !== "all" && !!state.category) ||
    state.sort !== "featured" ||
    !!state.query.trim()
  );
}

type Props = {
  state: DirectoryState;
  onChange: (patch: Partial<DirectoryState>) => void;
  onReset: () => void;
};

/**
 * The single sticky control row for /groups: live search on the left, City ·
 * Field · Sort on the right, and a clear button once anything is active.
 * All state is URL-backed and owned by the route.
 */
export function GroupsControlRow({ state, onChange, onReset }: Props) {
  const { data: allGroups = [] } = useAllPublicGroups();
  const active = isDirectoryFiltered(state);

  const cities = useMemo(
    () =>
      allGroups
        .filter((g) => g.kind === "city")
        .sort((a, b) => b.member_count - a.member_count || a.name.localeCompare(b.name))
        .map((g) => g.name),
    [allGroups],
  );

  const fields = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of allGroups) {
      if (!g.category) continue;
      const c = normalizeCategory(g.category);
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || categoryLabel(a[0]).localeCompare(categoryLabel(b[0])))
      .map(([id, count]) => ({ id, count }));
  }, [allGroups]);

  // Debounce typing so each keystroke doesn't push a navigation.
  const [draft, setDraft] = useState(state.query);
  const dirty = useRef(false);
  useEffect(() => {
    if (!dirty.current) setDraft(state.query);
  }, [state.query]);
  useEffect(() => {
    if (!dirty.current) return;
    const id = window.setTimeout(() => {
      dirty.current = false;
      if (draft !== state.query) onChange({ query: draft });
    }, 200);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const selectedCity = cities.find((c) => c.toLocaleLowerCase() === state.query.trim().toLocaleLowerCase()) ?? "";
  const category = state.category === "all" || !state.category ? "all" : normalizeCategory(state.category);

  return (
    <div className="sticky top-11 z-30 border-b border-border bg-background/80 backdrop-blur-md md:top-14">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2.5 md:flex-row md:items-center md:justify-between md:px-6">
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-surface px-3.5 md:max-w-sm">
          <Search className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
          <span className="sr-only">Search groups</span>
          <input
            value={draft}
            onChange={(e) => {
              dirty.current = true;
              setDraft(e.target.value);
            }}
            placeholder="Search scenes, cities, mediums…"
            aria-label="Search groups"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-muted/70 focus:outline-none"
          />
          {draft ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                dirty.current = true;
                setDraft("");
              }}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-muted transition hover:bg-muted hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </label>

        <div className="flex items-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <select
            aria-label="Filter by city"
            className={`${PILL} min-w-[11rem]`}
            value={selectedCity}
            onChange={(e) => {
              dirty.current = false;
              setDraft(e.target.value);
              onChange({ query: e.target.value, tab: "all" });
            }}
          >
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by field"
            className={`${PILL} min-w-[11rem]`}
            value={category}
            onChange={(e) => onChange({ category: e.target.value })}
          >
            <option value="all">All fields</option>
            {fields.map(({ id, count }) => (
              <option key={id} value={id}>
                {categoryLabel(id)} ({count})
              </option>
            ))}
          </select>

          <select
            aria-label="Sort groups"
            className={`${PILL} min-w-[11rem]`}
            value={state.sort}
            onChange={(e) => onChange({ sort: e.target.value as GroupsSort })}
          >
            {SORT_VALUES.map((s) => (
              <option key={s} value={s}>
                Sort: {SORT_LABELS[s]}
              </option>
            ))}
          </select>

          {active ? (
            <button
              type="button"
              aria-label="Clear filters"
              onClick={() => {
                dirty.current = false;
                setDraft("");
                onReset();
              }}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-surface text-ink-muted transition-colors hover:border-ink/40 hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

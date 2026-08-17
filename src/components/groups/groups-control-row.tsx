import { useMemo } from "react";
import {
  useAllPublicGroups,
  type DirectoryState,
  type GroupsSort,
  SORT_VALUES,
} from "@/components/groups/groups-directory";
import {
  FilterClear,
  FilterControls,
  FilterHeader,
  FilterSearch,
  FilterSelect,
} from "@/components/filter-header";
import { categoryLabel, normalizeCategory } from "@/lib/taxonomy";

const SORT_LABELS: Record<GroupsSort, string> = {
  featured: "Featured",
  members: "Most members",
  content: "Most content",
  az: "A–Z",
};

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

  const selectedCity =
    cities.find((c) => c.toLocaleLowerCase() === state.query.trim().toLocaleLowerCase()) ?? "";
  const category =
    state.category === "all" || !state.category ? "all" : normalizeCategory(state.category);

  return (
    <FilterHeader>
      <FilterSearch
        value={state.query}
        onChange={(q) => onChange({ query: q })}
        label="Search groups"
        placeholder="Search scenes, cities, mediums…"
      />

      <FilterControls>
        <FilterSelect
          label="Filter by city"
          width="min-w-[11rem]"
          value={selectedCity}
          onChange={(v) => onChange({ query: v, tab: "all" })}
        >
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          label="Filter by field"
          width="min-w-[11rem]"
          value={category}
          onChange={(v) => onChange({ category: v })}
        >
          <option value="all">All fields</option>
          {fields.map(({ id, count }) => (
            <option key={id} value={id}>
              {categoryLabel(id)} ({count})
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          label="Sort groups"
          width="min-w-[11rem]"
          value={state.sort}
          onChange={(v) => onChange({ sort: v as GroupsSort })}
        >
          {SORT_VALUES.map((s) => (
            <option key={s} value={s}>
              Sort: {SORT_LABELS[s]}
            </option>
          ))}
        </FilterSelect>

        {active ? <FilterClear onClick={onReset} /> : null}
      </FilterControls>
    </FilterHeader>
  );
}

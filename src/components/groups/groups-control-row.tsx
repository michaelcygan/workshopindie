import { useMemo } from "react";
import {
  useAllPublicGroups,
  type DirectoryState,
  type GroupsSort,
  type GroupsTab,
  SORT_VALUES,
} from "@/components/groups/groups-directory";
import {
  FilterClear,
  FilterControls,
  FilterHeader,
  FilterSearch,
  FilterSelect,
  FilterToggleGroup,
} from "@/components/filter-header";
import { FilterCityPicker } from "@/components/filter-header/filter-city-picker";
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
    !!state.city.trim() ||
    !!state.query.trim()
  );
}

type Props = {
  state: DirectoryState;
  onChange: (patch: Partial<DirectoryState>) => void;
  onReset: () => void;
  authenticated: boolean;
};

/**
 * The single sticky control row for /groups: kind, live search, City · Medium ·
 * Sort, and a clear button once anything is active. Identical for logged-out
 * and signed-in visitors apart from the "Your groups" tab. All state is
 * URL-backed and owned by the route.
 */
export function GroupsControlRow({ state, onChange, onReset, authenticated }: Props) {
  const { data: allGroups = [] } = useAllPublicGroups();
  const active = isDirectoryFiltered(state);

  const cities = useMemo(
    () =>
      allGroups
        .filter((g) => g.kind === "city")
        .map((g) => ({ value: g.name, label: g.name, count: g.member_count })),
    [allGroups],
  );

  const mediums = useMemo(() => {
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

  const category =
    state.category === "all" || !state.category ? "all" : normalizeCategory(state.category);

  const kindOptions = useMemo(() => {
    const base: { value: GroupsTab; label: string }[] = [
      { value: "all", label: "All" },
      { value: "for-you", label: "Yours" },
      { value: "genre", label: "Fields" },
      { value: "scene", label: "Scenes" },
      { value: "micro", label: "Micro" },
      { value: "city", label: "Cities" },
    ];
    return base.filter((o) => (o.value === "for-you" ? authenticated : true));
  }, [authenticated]);

  return (
    <FilterHeader>
      <FilterSearch
        value={state.query}
        onChange={(q) => onChange({ query: q })}
        label="Search groups"
        placeholder="Search scenes, cities, mediums…"
      />

      <FilterControls>
        <FilterToggleGroup
          value={state.tab}
          onChange={(t) => onChange({ tab: t })}
          options={kindOptions}
        />

        <FilterCityPicker
          value={state.city}
          onChange={(city) => onChange({ city })}
          options={cities}
        />

        <FilterSelect
          label="Filter by medium"
          width="min-w-[11rem]"
          value={category}
          onChange={(v) => onChange({ category: v })}
        >
          <option value="all">All mediums</option>
          {mediums.map(({ id, count }) => (
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

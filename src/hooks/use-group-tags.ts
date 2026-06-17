import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type GroupTag = {
  id: string;
  slug: string;
  name: string;
  kind: "city" | "genre" | "micro" | "scene";
};

type Kind = "work" | "collab" | "workshop";

const TABLE: Record<Kind, "group_works" | "group_collabs" | "group_workshops"> = {
  work: "group_works",
  collab: "group_collabs",
  workshop: "group_workshops",
};

const FK: Record<Kind, "work_id" | "collab_post_id" | "workshop_id"> = {
  work: "work_id",
  collab: "collab_post_id",
  workshop: "workshop_id",
};

/**
 * Bulk-fetch group tags for a collection of item IDs.
 * Returns a Map from item id -> GroupTag[].
 */
export function useGroupTagsFor(kind: Kind, ids: string[]) {
  const key = ids.slice().sort().join(",");
  return useQuery({
    queryKey: ["group-tags", kind, key],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const fk = FK[kind];
      const { data, error } = await supabase
        .from(TABLE[kind])
        .select(`${fk}, groups(id,slug,name,kind,deleted_at)`)
        .in(fk, ids);
      if (error) throw error;
      const map = new Map<string, GroupTag[]>();
      for (const row of (data ?? []) as Array<Record<string, unknown>>) {
        const itemId = row[fk] as string;
        const g = row.groups as
          | { id: string; slug: string; name: string; kind: GroupTag["kind"]; deleted_at: string | null }
          | null;
        if (!g || g.deleted_at) continue;
        const list = map.get(itemId) ?? [];
        list.push({ id: g.id, slug: g.slug, name: g.name, kind: g.kind });
        map.set(itemId, list);
      }
      return map;
    },
  });
}

/** Stable re-ranking: items tagged with any of `myGroupIds` move to the front. */
export function rerankByMyGroups<T extends { id: string }>(
  items: T[],
  tagMap: Map<string, GroupTag[]> | undefined,
  myGroupIds: Set<string>,
): T[] {
  if (!tagMap || myGroupIds.size === 0) return items;
  const score = (id: string) => {
    const tags = tagMap.get(id);
    if (!tags) return 0;
    return tags.some((t) => myGroupIds.has(t.id)) ? 1 : 0;
  };
  return items
    .map((it, idx) => ({ it, idx, s: score(it.id) }))
    .sort((a, b) => b.s - a.s || a.idx - b.idx)
    .map((x) => x.it);
}

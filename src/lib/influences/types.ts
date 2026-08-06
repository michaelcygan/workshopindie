import type { Category } from "@/lib/categories";

export const MAX_INFLUENCES = 10;

export type InfluenceSourceKind = "workshop_work" | "external";

export type Influence = {
  id: string;
  position: number;
  source_kind: InfluenceSourceKind;
  work_id: string | null;
  external_url: string | null;
  title: string | null;
  creator_name: string | null;
  category: string | null;
  thumbnail_url: string | null;
  provider: string | null;
  /** Live Work data, present only when the Work is still visible. */
  work: {
    id: string;
    slug: string;
    title: string;
    cover_url: string | null;
    category: Category | null;
  } | null;
};

/** Stable display fields: live Work data wins, stored snapshot is the fallback. */
export function influenceDisplay(i: Influence) {
  return {
    title: i.work?.title ?? i.title ?? "Untitled",
    creator: i.creator_name,
    category: (i.work?.category ?? i.category ?? null) as string | null,
    thumbnail: i.work?.cover_url ?? i.thumbnail_url ?? null,
  };
}

/**
 * One shared Work-card select string + row→card mapper.
 *
 * Gallery, Following, Favorites, profile rails and every other Work rail read
 * through this so card metadata (Category · Medium, cover, byline, Subject cue)
 * can never drift between surfaces.
 */
import type { WorkCardData } from "@/components/work-card";
import type { Category } from "@/lib/categories";

/** Columns every Work card needs. Keep this the only place it is spelled out. */
export const WORK_CARD_SELECT =
  "id,title,slug,category,categories,category_canonical,categories_canonical,category_id,subtype,subcategories,subjects,excerpt,cover_url,cover_aspect,cover_focal_x,cover_focal_y,embed_url,source_type,like_count,save_count,view_count,published_at,created_at,created_by, work_credits(role_label, sort_order, display_name, profiles(id,display_name,username))";

export type WorkCardRow = {
  id: string;
  title: string;
  slug: string;
  category: Category;
  categories?: Category[] | null;
  category_canonical?: string | null;
  categories_canonical?: string[] | null;
  category_id?: string | null;
  subtype?: string | null;
  subcategories?: string[] | null;
  subjects?: string[] | null;
  excerpt?: string | null;
  cover_url: string | null;
  cover_aspect?: string | null;
  cover_focal_x?: number | null;
  cover_focal_y?: number | null;
  embed_url?: string | null;
  source_type: string;
  like_count: number;
  save_count: number;
  view_count: number;
  published_at?: string | null;
  created_by?: string;
  work_credits?: {
    sort_order: number;
    display_name: string | null;
    profiles: { id: string; display_name: string | null; username: string | null } | null;
  }[];
};

export function toWorkCard(r: WorkCardRow): WorkCardData {
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    category: r.category,
    categories: r.categories ?? null,
    category_canonical: r.category_canonical ?? null,
    category_id: r.category_id ?? null,
    subtype: r.subtype ?? null,
    subcategories: r.subcategories ?? null,
    subjects: r.subjects ?? null,
    excerpt: r.excerpt ?? null,
    cover_url: r.cover_url,
    cover_aspect: r.cover_aspect ?? null,
    cover_focal_x: r.cover_focal_x ?? null,
    cover_focal_y: r.cover_focal_y ?? null,
    embed_url: r.embed_url ?? null,
    source_type: r.source_type,
    like_count: r.like_count,
    save_count: r.save_count,
    view_count: r.view_count,
    published_at: r.published_at ?? null,
    created_by: r.created_by,
    credits: (r.work_credits ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => ({
        id: c.profiles?.id ?? null,
        display_name: c.profiles?.display_name ?? c.display_name ?? null,
        username: c.profiles?.username ?? null,
      })),
  };
}

export const toWorkCards = (rows: readonly WorkCardRow[]) => rows.map(toWorkCard);

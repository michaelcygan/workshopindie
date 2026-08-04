/**
 * Blog editorial taxonomy — the single source of truth for Blog category
 * slugs, labels, descriptions and their Work-category mapping.
 *
 * Deliberately NOT the Postgres `category` enum: that enum stores legacy Work
 * identifiers and gathering topics shared by Works, Collabs, Groups and
 * Profiles. The Blog stores its own `blog_posts.category_slug` text column
 * guarded by a check constraint with exactly these six slugs.
 *
 * Normalization of Work categories is delegated to `@/lib/taxonomy` so this
 * module never becomes a competing taxonomy.
 */
import { normalizeCategory, type CanonicalCategory } from "@/lib/taxonomy";

export const BLOG_CATEGORY_SLUGS = [
  "general",
  "music",
  "film-video",
  "writing",
  "visual-art",
  "games-tech",
] as const;

export type BlogCategorySlug = (typeof BLOG_CATEGORY_SLUGS)[number];

export const DEFAULT_BLOG_CATEGORY: BlogCategorySlug = "general";

export type BlogCategory = {
  slug: BlogCategorySlug;
  label: string;
  /** Short editorial line used on category pages and their metadata. */
  description: string;
  /** Canonical Work category this Blog category represents, when it maps. */
  canonical: CanonicalCategory | null;
};

export const BLOG_CATEGORIES: readonly BlogCategory[] = [
  {
    slug: "general",
    label: "General",
    description:
      "Notes on making things independently — process, craft, and how Workshop works.",
    canonical: null,
  },
  {
    slug: "music",
    label: "Music",
    description:
      "Writing, recording, releasing, and playing music outside the major-label pipeline.",
    canonical: "music",
  },
  {
    slug: "film-video",
    label: "Film & Video",
    description:
      "Independent film and video: crews, shoots, edits, festivals, and getting work seen.",
    canonical: "film_video",
  },
  {
    slug: "writing",
    label: "Writing",
    description:
      "Essays, books, zines, and scripts — drafting, editing, and publishing on your own terms.",
    canonical: "writing",
  },
  {
    slug: "visual-art",
    label: "Visual Art",
    description:
      "Painting, photography, illustration, and design — studio practice and showing the work.",
    canonical: "visual_art",
  },
  {
    slug: "games-tech",
    label: "Games & Tech",
    description:
      "Games, software, and hardware built by small independent teams.",
    canonical: "games_tech",
  },
] as const;

const BY_SLUG = new Map(BLOG_CATEGORIES.map((c) => [c.slug, c]));
const BY_CANONICAL = new Map(
  BLOG_CATEGORIES.filter((c) => c.canonical).map((c) => [c.canonical as CanonicalCategory, c]),
);

export function isBlogCategorySlug(value: unknown): value is BlogCategorySlug {
  return typeof value === "string" && BY_SLUG.has(value as BlogCategorySlug);
}

/** Always returns a category; unknown/missing values fall back to General. */
export function getBlogCategory(value: string | null | undefined): BlogCategory {
  return (isBlogCategorySlug(value) ? BY_SLUG.get(value) : BY_SLUG.get(DEFAULT_BLOG_CATEGORY))!;
}

export function blogCategoryLabel(value: string | null | undefined): string {
  return getBlogCategory(value).label;
}

/** Coerce any input to a stored slug. Never throws; defaults to General. */
export function toBlogCategorySlug(value: unknown): BlogCategorySlug {
  return isBlogCategorySlug(value) ? value : DEFAULT_BLOG_CATEGORY;
}

/**
 * Map a stored Work category (`music`, `film`, `writing`, `writing_book`,
 * `visual`, `build`, …) to the Blog category it belongs under.
 * `writing_book` normalizes to Writing. Anything outside the Work families
 * (topics, community categories, null) falls back to General.
 */
export function blogCategoryFromWorkCategory(
  workCategory: string | null | undefined,
): BlogCategorySlug {
  const canonical = normalizeCategory(workCategory);
  if (!canonical) return DEFAULT_BLOG_CATEGORY;
  return BY_CANONICAL.get(canonical)?.slug ?? DEFAULT_BLOG_CATEGORY;
}

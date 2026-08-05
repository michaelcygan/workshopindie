/**
 * System Medium Groups — the five canonical, Workshop-managed Groups that act
 * as connective tissue across Works, Collabs, Blog posts, Events and Profiles.
 *
 * Membership and entity links are created automatically by database triggers
 * (see the `sync_*_medium_groups` functions). This module is the client-safe
 * mirror of that mapping: slug, label and the canonical taxonomy key.
 */
import { normalizeCategory, type CanonicalCategory } from "@/lib/taxonomy";

export const MEDIUM_GROUP_KEYS = [
  "music",
  "film_video",
  "writing",
  "visual_art",
  "games_tech",
] as const;

export type MediumGroupKey = (typeof MEDIUM_GROUP_KEYS)[number];

export type MediumGroup = {
  /** Canonical taxonomy key stored in `groups.taxonomy_key`. */
  key: MediumGroupKey;
  /** Route slug: `/g/<slug>`. */
  slug: string;
  label: string;
};

export const MEDIUM_GROUPS: readonly MediumGroup[] = [
  { key: "music", slug: "music", label: "Music" },
  { key: "film_video", slug: "film-video", label: "Film & Video" },
  { key: "writing", slug: "writing", label: "Writing" },
  { key: "visual_art", slug: "visual-art", label: "Visual Art" },
  { key: "games_tech", slug: "games-tech", label: "Games & Tech" },
] as const;

const BY_KEY = new Map(MEDIUM_GROUPS.map((m) => [m.key, m]));
const BY_SLUG = new Map(MEDIUM_GROUPS.map((m) => [m.slug, m]));

export function isMediumGroupKey(value: string | null | undefined): value is MediumGroupKey {
  return !!value && (MEDIUM_GROUP_KEYS as readonly string[]).includes(value);
}

/** The Medium Group for a canonical taxonomy key, if one exists. */
export function mediumGroupByKey(key: string | null | undefined): MediumGroup | null {
  return key ? BY_KEY.get(key as MediumGroupKey) ?? null : null;
}

/** The Medium Group for a `/g/<slug>` route slug, if that slug is system-managed. */
export function mediumGroupBySlug(slug: string | null | undefined): MediumGroup | null {
  return slug ? BY_SLUG.get(slug) ?? null : null;
}

/**
 * The Medium Group a stored category value (`works.category`,
 * `collab_posts.category`, `profiles.categories[]`) belongs to.
 */
export function mediumGroupForCategory(category: string | null | undefined): MediumGroup | null {
  if (!category) return null;
  const canonical = normalizeCategory(category) as CanonicalCategory | null;
  return mediumGroupByKey(canonical);
}

/** Deduplicated Medium Groups for a set of stored category values. */
export function mediumGroupsForCategories(categories: readonly (string | null | undefined)[]): MediumGroup[] {
  const seen = new Set<string>();
  const out: MediumGroup[] = [];
  for (const c of categories) {
    const m = mediumGroupForCategory(c);
    if (m && !seen.has(m.key)) {
      seen.add(m.key);
      out.push(m);
    }
  }
  return out;
}

/** Blog category slugs share the Medium Group slugs, except "general". */
export function mediumGroupForBlogCategory(slug: string | null | undefined): MediumGroup | null {
  if (!slug || slug === "general") return null;
  return mediumGroupBySlug(slug);
}

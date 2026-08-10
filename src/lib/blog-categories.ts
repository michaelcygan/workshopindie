/**
 * Blog editorial taxonomy — Blog sections are the canonical Fields.
 *
 * Every one of the 13 Fields is an editorial section at `/blog/c/<slug>`.
 * Slugs are derived from the Field ids so this module can never become a
 * competing vocabulary; `games-tech` is preserved as a legacy alias (and a
 * legal stored value) for the Software & AI section.
 *
 * `blog_posts.category_slug` stores the primary section; `blog_posts.fields`
 * stores the full Field selection; `blog_posts.subcategories` stores the
 * optional specialization.
 */
import {
  FIELD_IDS,
  fieldLabel,
  normalizeField,
  type CanonicalCategory,
  type FieldId,
} from "@/lib/taxonomy";

/** Field id -> url slug. Stable; do not re-derive from labels. */
const FIELD_SLUGS: Record<FieldId, string> = {
  other: "general",
  music: "music",
  film_video: "film-video",
  writing: "writing",
  visual_art: "visual-art",
  design: "design",
  performance: "performance",
  journalism_media: "journalism-media",
  software_ai: "software-ai",
  making_engineering: "making-engineering",
  science_research: "science-research",
  architecture_cities: "architecture-urbanism",
  environment_nature: "environment-nature",
};

/** Historic slugs that must keep resolving. Value is the modern slug. */
export const LEGACY_BLOG_SLUG_ALIASES: Record<string, string> = {
  "games-tech": "software-ai",
};

export const BLOG_CATEGORY_SLUGS = FIELD_IDS.map((id) => FIELD_SLUGS[id]) as readonly string[];

export type BlogCategorySlug = string;

export const DEFAULT_BLOG_CATEGORY = "general";

const DESCRIPTIONS: Record<FieldId, string> = {
  other: "Notes on making things independently — process, craft, business, and how Workshop works.",
  music: "Writing, recording, releasing, and playing music and audio outside the major-label pipeline.",
  film_video: "Independent film and video: crews, shoots, edits, festivals, and getting work seen.",
  writing: "Essays, books, zines, and scripts — drafting, editing, and publishing on your own terms.",
  visual_art: "Painting, photography, illustration, and studio practice — making and showing the work.",
  design: "Graphic, product, motion, and systems design practiced independently.",
  performance: "Theatre, dance, comedy, and live art — rehearsal, staging, and the room itself.",
  journalism_media: "Reporting, criticism, and independent media built outside legacy newsrooms.",
  software_ai: "Software, games, and AI built by small independent teams.",
  making_engineering: "Woodworking, textiles, electronics, fabrication — building things with your hands.",
  science_research: "Independent and academic research, methods, and communicating findings.",
  architecture_cities: "Buildings, public space, infrastructure, and the practice of shaping cities.",
  environment_nature: "Ecology, climate, land, and the work of tending to the world around us.",
};

export type BlogCategory = {
  slug: string;
  label: string;
  description: string;
  /** The Field this section represents. `other` is General. */
  field: FieldId;
  /** Canonical Work category this section represents, when it maps. */
  canonical: CanonicalCategory | null;
};

export const BLOG_CATEGORIES: readonly BlogCategory[] = FIELD_IDS.map((id) => ({
  slug: FIELD_SLUGS[id],
  label: fieldLabel(id),
  description: DESCRIPTIONS[id],
  field: id,
  canonical: id === "other" ? null : (id as CanonicalCategory),
}));

const BY_SLUG = new Map(BLOG_CATEGORIES.map((c) => [c.slug, c]));
const BY_FIELD = new Map(BLOG_CATEGORIES.map((c) => [c.field, c]));

/** Resolve a slug through legacy aliases. Returns null for unknown slugs. */
export function resolveBlogSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const direct = BY_SLUG.has(value) ? value : LEGACY_BLOG_SLUG_ALIASES[value];
  return direct ?? null;
}

export function isBlogCategorySlug(value: unknown): value is BlogCategorySlug {
  return resolveBlogSlug(value) !== null;
}

/** True when the slug only resolves through a legacy alias (301 candidates). */
export function isLegacyBlogSlug(value: string): boolean {
  return !BY_SLUG.has(value) && !!LEGACY_BLOG_SLUG_ALIASES[value];
}

/** Always returns a category; unknown/missing values fall back to General. */
export function getBlogCategory(value: string | null | undefined): BlogCategory {
  const slug = resolveBlogSlug(value) ?? DEFAULT_BLOG_CATEGORY;
  return BY_SLUG.get(slug)!;
}

export function blogCategoryLabel(value: string | null | undefined): string {
  return getBlogCategory(value).label;
}

/** Coerce any input to a stored slug. Never throws; defaults to General. */
export function toBlogCategorySlug(value: unknown): BlogCategorySlug {
  return resolveBlogSlug(value) ?? DEFAULT_BLOG_CATEGORY;
}

/** Map a stored Work/legacy category to the Blog section it belongs under. */
export function blogCategoryFromWorkCategory(
  workCategory: string | null | undefined,
): BlogCategorySlug {
  return blogCategorySlugForField(workCategory);
}

export function blogCategorySlugForField(field: string | null | undefined): BlogCategorySlug {
  return BY_FIELD.get(normalizeField(field))?.slug ?? DEFAULT_BLOG_CATEGORY;
}

export function fieldForBlogCategory(slug: string | null | undefined): FieldId {
  return getBlogCategory(slug).field;
}

/** A post's Fields, primary first: stored Fields win, legacy slug is fallback. */
export function blogPostFields(
  fields: readonly (string | null)[] | null | undefined,
  categorySlug?: string | null,
): FieldId[] {
  const stored = (fields ?? []).filter(Boolean).map((f) => normalizeField(f));
  const deduped: FieldId[] = [];
  for (const f of stored) if (!deduped.includes(f)) deduped.push(f);
  if (deduped.length > 0) return deduped;
  const fallback = fieldForBlogCategory(categorySlug);
  return fallback === "other" ? [] : [fallback];
}

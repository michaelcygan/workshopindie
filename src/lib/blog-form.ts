/**
 * The one Blog classification model.
 *
 * Category → Post type → Field → Subject → linked Workshop entities.
 *
 * Both editors (admin CMS and the member composer at /me/blog/$id) hydrate,
 * validate, and build write payloads through this module so the two can never
 * drift. Client-safe: no server imports.
 */
import { blogCategorySlugForField, blogPostFields } from "@/lib/blog-categories";
import {
  MAX_BLOG_SUBJECTS,
  blogSectionForStoryType,
  blogStoryTypeLabel,
  normalizeBlogSubjects,
  resolvePostType,
  toBlogStoryTypes,
  type BlogSection,
  type BlogStoryType,
} from "@/lib/blog-story-types";
import { fieldLabel, type FieldId } from "@/lib/taxonomy";

export const MAX_BLOG_FIELDS = 3;

/** Anything a stored `blog_posts` row can hand the editors. */
export type BlogTaxonomyRow = {
  story_type?: string | null;
  story_types?: string[] | null;
  fields?: string[] | null;
  category_slug?: string | null;
  subjects?: string[] | null;
  subcategories?: string[] | null;
};

export type BlogTaxonomyState = {
  /** Single Post type. `null` is legal on a draft, never on a new publish. */
  postType: BlogStoryType | null;
  /** Canonical Fields, primary first. Never empty — defaults to `["other"]`. */
  fields: FieldId[];
  /** Author-written Subjects, lead first. */
  subjects: string[];
  /** Untouched legacy values, carried through unrelated edits. */
  legacyStoryTypes: BlogStoryType[];
  legacySubcategories: string[];
};

export function hydrateBlogTaxonomy(row: BlogTaxonomyRow | null | undefined): BlogTaxonomyState {
  const hydratedFields = blogPostFields(row?.fields, row?.category_slug);
  return {
    postType: resolvePostType(row ?? {}),
    fields: hydratedFields.length > 0 ? hydratedFields.slice(0, MAX_BLOG_FIELDS) : ["other"],
    subjects: normalizeBlogSubjects(row?.subjects ?? []),
    legacyStoryTypes: toBlogStoryTypes(row?.story_types),
    legacySubcategories: (row?.subcategories ?? []).filter(
      (s): s is string => typeof s === "string" && s.length > 0,
    ),
  };
}

/** "General must stand alone" — selecting another Field drops the placeholder. */
export function normalizeBlogFields(next: readonly string[]): FieldId[] {
  const out: FieldId[] = [];
  for (const f of next) {
    const id = f as FieldId;
    if (!out.includes(id)) out.push(id);
  }
  const real = out.filter((f) => f !== "other");
  const resolved = real.length > 0 ? real : out;
  return (resolved.length > 0 ? resolved : (["other"] as FieldId[])).slice(0, MAX_BLOG_FIELDS);
}

export type BlogTaxonomyPayload = {
  category_slug: string;
  fields: FieldId[];
  subjects: string[];
  story_type: BlogStoryType | null;
  story_types: BlogStoryType[];
};

/**
 * Build the write payload. `initialPostType` is the value the row was hydrated
 * with: when it is unchanged, legacy secondary `story_types` survive the save.
 */
export function buildBlogTaxonomyPayload(
  state: BlogTaxonomyState,
  initialPostType?: BlogStoryType | null,
): BlogTaxonomyPayload {
  const fields = normalizeBlogFields(state.fields);
  const changed = initialPostType !== undefined && initialPostType !== state.postType;
  const storyTypes = changed
    ? state.postType
      ? [state.postType]
      : []
    : state.postType
      ? [state.postType, ...state.legacyStoryTypes.filter((t) => t !== state.postType)]
      : state.legacyStoryTypes;

  return {
    // Legacy routing mirror only — never presented as the editorial Category.
    category_slug: blogCategorySlugForField(fields[0]),
    fields,
    subjects: normalizeBlogSubjects(state.subjects),
    story_type: state.postType,
    story_types: storyTypes.slice(0, 3),
  };
}

/** Publish-time rule: a newly published post must declare exactly one type. */
export function validateBlogForPublish(state: {
  postType: BlogStoryType | null;
}): string | null {
  if (!state.postType) return "Choose a post type before publishing.";
  return null;
}

/* -------------------------------------------------------------------------- */
/* Card + article classification                                              */
/* -------------------------------------------------------------------------- */

export type BlogClassification = {
  postType: BlogStoryType | null;
  postTypeLabel: string | null;
  section: BlogSection | null;
  fields: FieldId[];
  /** Human labels for `fields`, primary first. */
  fieldLabels: string[];
  subjects: string[];
  leadSubject: string | null;
  /** Eyebrow parts, already resolved: POST TYPE · LEAD SUBJECT (or Field). */
  eyebrow: string[];
};

/**
 * The single resolver every Blog card, rail, feed, and article header uses.
 * Eyebrow rule: Post type · lead Subject, falling back to the primary Field,
 * then to Post type alone.
 */
export function resolveBlogClassification(row: BlogTaxonomyRow): BlogClassification {
  const postType = resolvePostType(row);
  const postTypeLabel = blogStoryTypeLabel(postType);
  const fields = blogPostFields(row.fields, row.category_slug);
  const subjects = normalizeBlogSubjects(row.subjects ?? []);
  const leadSubject = subjects[0] ?? null;
  const primaryField = fields[0] ?? null;

  const second = leadSubject ?? (primaryField ? fieldLabel(primaryField) : null);
  const eyebrow = [postTypeLabel, second].filter((v): v is string => !!v);

  return {
    postType,
    postTypeLabel,
    section: blogSectionForStoryType(postType),
    fields,
    fieldLabels: fields.map((f) => fieldLabel(f)),
    subjects,
    leadSubject,
    eyebrow,
  };
}

export function blogEyebrowText(row: BlogTaxonomyRow): string {
  return resolveBlogClassification(row).eyebrow.join(" · ");
}

export { MAX_BLOG_SUBJECTS };

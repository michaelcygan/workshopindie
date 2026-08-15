/**
 * Blog Post type and the editorial Category derived from it.
 *
 * Post type — *what kind of piece* a Blog post is. One per post.
 * Category  — the broad editorial section the post appears in. Never stored:
 *             it is derived from Post type so the two can never drift apart.
 *
 * Both are a separate dimension from Fields (`blog_posts.fields`), which
 * describe the discipline the piece connects to, and from Subjects
 * (`blog_posts.subjects`), which describe what it is directly about.
 */
import { normalizeTags } from "@/lib/entity-tags";

export const BLOG_STORY_TYPES = [
  { id: "essay", label: "Essay" },
  { id: "report", label: "Report" },
  { id: "tutorial", label: "Tutorial" },
  { id: "interview", label: "Interview" },
  { id: "news", label: "News" },
  { id: "research_note", label: "Process Note" },
  { id: "review", label: "Review" },
  { id: "journal", label: "Journal" },
] as const;

export const BLOG_STORY_TYPE_IDS = BLOG_STORY_TYPES.map((t) => t.id) as unknown as [
  BlogStoryType,
  ...BlogStoryType[],
];

export type BlogStoryType = (typeof BLOG_STORY_TYPES)[number]["id"];

export function isBlogStoryType(value: unknown): value is BlogStoryType {
  return typeof value === "string" && BLOG_STORY_TYPES.some((t) => t.id === value);
}

/** Post type is optional on a draft — an untyped post is simply "a post". */
export function toBlogStoryType(value: unknown): BlogStoryType | null {
  return isBlogStoryType(value) ? value : null;
}

export function blogStoryTypeLabel(value: unknown): string | null {
  return BLOG_STORY_TYPES.find((t) => t.id === value)?.label ?? null;
}

/**
 * Legacy shape: posts written before single-select carry `story_types`.
 * Kept for hydration and preservation only — new writes store one type.
 */
export const BLOG_STORY_TYPE_MAX = 3;

/** Normalize an arbitrary value into a deduped, capped list of Post types. */
export function toBlogStoryTypes(value: unknown): BlogStoryType[] {
  if (!Array.isArray(value)) {
    const single = toBlogStoryType(value);
    return single ? [single] : [];
  }
  const out: BlogStoryType[] = [];
  for (const v of value) {
    const t = toBlogStoryType(v);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= BLOG_STORY_TYPE_MAX) break;
  }
  return out;
}

/**
 * The canonical Post type of a stored row: `story_type` wins, else the first
 * valid entry of the legacy `story_types` array.
 */
export function resolvePostType(row: {
  story_type?: unknown;
  story_types?: unknown;
}): BlogStoryType | null {
  return toBlogStoryType(row?.story_type) ?? toBlogStoryTypes(row?.story_types)[0] ?? null;
}

/* -------------------------------------------------------------------------- */
/* Derived editorial Category                                                 */
/* -------------------------------------------------------------------------- */

export const BLOG_SECTIONS = [
  {
    id: "essays",
    label: "Essays",
    description: "Arguments, reporting, and criticism from independent makers.",
    types: ["essay", "report", "review"],
  },
  {
    id: "interviews",
    label: "Interviews",
    description: "Conversations with the people making the work.",
    types: ["interview"],
  },
  {
    id: "field-notes",
    label: "Field Notes",
    description: "Process notes and working journals from inside the making.",
    types: ["research_note", "journal"],
  },
  {
    id: "resources",
    label: "Resources",
    description: "Step-by-step guides and practical how-tos.",
    types: ["tutorial"],
  },
  {
    id: "announcements",
    label: "Announcements",
    description: "News from Workshop and the scenes it serves.",
    types: ["news"],
  },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  description: string;
  types: readonly BlogStoryType[];
}>;

export type BlogSectionId = (typeof BLOG_SECTIONS)[number]["id"];
export type BlogSection = (typeof BLOG_SECTIONS)[number];

const SECTION_BY_ID = new Map<string, BlogSection>(BLOG_SECTIONS.map((s) => [s.id, s]));
const SECTION_BY_TYPE = new Map<BlogStoryType, BlogSection>();
for (const s of BLOG_SECTIONS) for (const t of s.types) SECTION_BY_TYPE.set(t, s);

export function isBlogSectionId(value: unknown): value is BlogSectionId {
  return typeof value === "string" && SECTION_BY_ID.has(value);
}

export function getBlogSection(value: unknown): BlogSection | null {
  return typeof value === "string" ? (SECTION_BY_ID.get(value) ?? null) : null;
}

/** The single editorial Category a Post type belongs to. */
export function blogSectionForStoryType(value: unknown): BlogSection | null {
  const t = toBlogStoryType(value);
  return t ? (SECTION_BY_TYPE.get(t) ?? null) : null;
}

/** The Post types a Category covers — used for server-side filtering. */
export function storyTypesForSection(sectionId: string): BlogStoryType[] {
  return [...(SECTION_BY_ID.get(sectionId)?.types ?? [])];
}

/* -------------------------------------------------------------------------- */
/* Subjects                                                                    */
/* -------------------------------------------------------------------------- */

/** A Blog post may carry up to this many Subjects; the first is the lead. */
export const MAX_BLOG_SUBJECTS = 5;

export function normalizeBlogSubjects(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return normalizeTags(value as (string | null | undefined)[], MAX_BLOG_SUBJECTS);
}

export const BLOG_SUBJECT_SUGGESTIONS = [
  "Process",
  "Craft",
  "Money",
  "Community",
  "Mental health",
  "Faith",
  "Identity",
  "City life",
  "Collaboration",
  "Tools",
  "Publishing",
  "Touring",
  "Archives",
  "Teaching",
  "Climate",
  "Technology",
  "Nightlife",
  "History",
];

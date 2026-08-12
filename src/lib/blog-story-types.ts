/**
 * Editorial story type — *what kind of piece* a Blog post is.
 *
 * Deliberately a separate dimension from Fields (`blog_posts.fields`), which
 * describe *what the piece is about*. An Essay about Software & AI and a
 * Report about Software & AI share a Field and nothing else, so the two must
 * never collapse into one list.
 */
export const BLOG_STORY_TYPES = [
  { id: "essay", label: "Essay" },
  { id: "report", label: "Report" },
  { id: "tutorial", label: "Tutorial" },
  { id: "interview", label: "Interview" },
  { id: "news", label: "News" },
  { id: "research_note", label: "Process note" },
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

/** Story type is optional — an untyped post is simply "a post". */
export function toBlogStoryType(value: unknown): BlogStoryType | null {
  return isBlogStoryType(value) ? value : null;
}

export function blogStoryTypeLabel(value: unknown): string | null {
  return BLOG_STORY_TYPES.find((t) => t.id === value)?.label ?? null;
}

/** A post may carry up to this many story types; the first is the primary. */
export const BLOG_STORY_TYPE_MAX = 3;

/** Normalize an arbitrary value into a deduped, capped list of story types. */
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

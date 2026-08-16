/**
 * Shared Blog filtering: Field and Subject.
 *
 * Category (Post type) lives in the nav rail; these two narrow whatever the
 * current Category view already shows. Options are derived from the posts on
 * screen so a filter is never offered when it would return nothing.
 */
import { resolveBlogClassification } from "@/lib/blog-form";
import { fieldLabel } from "@/lib/taxonomy";

export type BlogFilterValue = { field?: string; subject?: string };
export type BlogFilterOption = { value: string; label: string };

type AnyPost = Record<string, unknown>;

function uniq(pairs: Array<[string, string]>): BlogFilterOption[] {
  const map = new Map<string, string>();
  for (const [value, label] of pairs) if (!map.has(value)) map.set(value, label);
  return [...map]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function classifyBlogPosts<T extends AnyPost>(posts: T[]) {
  return posts.map((post) => ({ post, cls: resolveBlogClassification(post) }));
}

export function deriveBlogFilterOptions(
  classified: ReturnType<typeof classifyBlogPosts>,
): { fields: BlogFilterOption[]; subjects: BlogFilterOption[] } {
  return {
    fields: uniq(
      classified.flatMap(({ cls }) =>
        cls.fields.filter((f) => f !== "other").map((f) => [f, fieldLabel(f)] as [string, string]),
      ),
    ),
    subjects: uniq(
      classified.flatMap(({ cls }) =>
        cls.subjects.map((s) => [s.toLowerCase(), s] as [string, string]),
      ),
    ),
  };
}

export function applyBlogFilters<T extends AnyPost>(
  classified: Array<{ post: T; cls: ReturnType<typeof resolveBlogClassification> }>,
  value: BlogFilterValue,
): T[] {
  return classified
    .filter(({ cls }) => {
      if (value.field && !cls.fields.includes(value.field as never)) return false;
      if (
        value.subject &&
        !cls.subjects.some((s) => s.toLowerCase() === value.subject!.toLowerCase())
      )
        return false;
      return true;
    })
    .map(({ post }) => post);
}

export function parseBlogFilterSearch(search: Record<string, unknown>): BlogFilterValue {
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  return { field: str(search.field), subject: str(search.subject) };
}

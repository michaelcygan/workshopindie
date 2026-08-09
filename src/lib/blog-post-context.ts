/**
 * Derived view model for the public expression of a Blog post's structured
 * creative graph ("About this post").
 *
 * This is a *derivation*, not storage: every field comes from relationships the
 * Blog already persists (`blog_posts.category_slug` + `blog_post_entity_tags`).
 * Centralizing it here means future Workshop surfaces ("Writing about this
 * Work", "Stories from a Group") can reuse the same shape instead of
 * re-implementing relationship logic per page.
 *
 * Client-safe: no server imports.
 */
import { getBlogCategory, type BlogCategory } from "@/lib/blog-categories";
import type { BlogEntityTag, BlogWorkSummary } from "@/lib/blog-entity-tags";
import { workshopEntityUrl } from "@/lib/entities/kinds";

export type BlogContextWork = Extract<BlogEntityTag, { kind: "work" }>;
export type BlogContextCollab = Extract<BlogEntityTag, { kind: "collab" }>;
export type BlogContextGroup = Extract<BlogEntityTag, { kind: "group" }>;
export type BlogContextEvent = Extract<BlogEntityTag, { kind: "event" }>;
export type BlogContextPerson = Extract<BlogEntityTag, { kind: "profile" }>;

export type BlogPostContext = {
  editorialCategory: BlogCategory;
  /** Formats derived from linked Work subtypes. Deduplicated, order preserved. */
  mediums: string[];
  works: BlogContextWork[];
  people: BlogContextPerson[];
  collabs: BlogContextCollab[];
  groups: BlogContextGroup[];
  events: BlogContextEvent[];
  /** True when at least one relationship group has content worth rendering. */
  hasContext: boolean;
};

export type DeriveBlogPostContextInput = {
  categorySlug: string | null | undefined;
  tags: BlogEntityTag[] | null | undefined;
  /** Byline profile ids — tagged people who are already credited above are dropped. */
  authorProfileIds?: Array<string | null | undefined>;
  authorUsernames?: Array<string | null | undefined>;
};

function normalizeMedium(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  // Stored subtypes are already human labels ("Short film"); only repair
  // all-lower or snake_case legacy values.
  const spaced = s.replace(/_/g, " ");
  return /[A-Z]/.test(spaced) ? spaced : spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function deriveBlogPostContext(input: DeriveBlogPostContextInput): BlogPostContext {
  const tags = input.tags ?? [];
  const editorialCategory = getBlogCategory(input.categorySlug);

  const works = tags.filter((t): t is BlogContextWork => t.kind === "work");
  const collabs = tags.filter((t): t is BlogContextCollab => t.kind === "collab");
  const groups = tags.filter((t): t is BlogContextGroup => t.kind === "group");
  const events = tags.filter((t): t is BlogContextEvent => t.kind === "event");

  const authorIds = new Set(
    (input.authorProfileIds ?? []).filter((v): v is string => typeof v === "string" && !!v),
  );
  const authorNames = new Set(
    (input.authorUsernames ?? [])
      .filter((v): v is string => typeof v === "string" && !!v)
      .map((v) => v.toLowerCase()),
  );
  const people = tags.filter(
    (t): t is BlogContextPerson =>
      t.kind === "profile" && !authorIds.has(t.id) && !authorNames.has(t.username.toLowerCase()),
  );

  const seenMedium = new Set<string>();
  const mediums: string[] = [];
  for (const w of works) {
    const summary = (w as { work?: BlogWorkSummary | null }).work;
    const label = normalizeMedium(summary?.subtype ?? "");
    if (!label) continue;
    const key = label.toLowerCase();
    if (seenMedium.has(key)) continue;
    seenMedium.add(key);
    mediums.push(label);
  }

  const hasContext =
    works.length > 0 ||
    people.length > 0 ||
    collabs.length > 0 ||
    groups.length > 0 ||
    events.length > 0;

  return { editorialCategory, mediums, works, people, collabs, groups, events, hasContext };
}

/** Schema.org `mentions` nodes describing exactly what "About this post" shows. */
export function contextMentions(ctx: BlogPostContext, site: string) {
  const nodes: Array<{ "@type": string; name: string; url: string }> = [];
  const push = (type: string, name: string, path: string) =>
    nodes.push({ "@type": type, name, url: `${site}${path}` });
  for (const w of ctx.works) push("CreativeWork", w.label, workshopEntityUrl({ kind: "work", slug: w.slug }));
  for (const p of ctx.people) push("Person", p.label, `/${p.username}`);
  for (const c of ctx.collabs) push("Thing", c.label, workshopEntityUrl({ kind: "collab", slug: c.slug }));
  for (const g of ctx.groups) push("Organization", g.label, workshopEntityUrl({ kind: "group", slug: g.slug }));
  for (const e of ctx.events) push("Event", e.label, workshopEntityUrl({ kind: "event", groupSlug: e.groupSlug, slug: e.slug }));
  return nodes;
}

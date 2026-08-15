/**
 * Derived view model for the public expression of a Blog post's structured
 * creative graph ("About this post").
 *
 * This is a *derivation*, not storage: every field comes from the post's own
 * taxonomy (`story_type`, `fields`, `subjects`) plus the relationships the Blog
 * already persists (`blog_post_entity_tags`). Centralizing it here means future
 * Workshop surfaces ("Writing about this Work", "Stories from a Group") can
 * reuse the same shape instead of re-implementing relationship logic per page.
 *
 * Client-safe: no server imports.
 */
import type { BlogEntityTag } from "@/lib/blog-entity-tags";
import { resolveBlogClassification, type BlogClassification } from "@/lib/blog-form";
import { workshopEntityUrl } from "@/lib/entities/kinds";

export type BlogContextWork = Extract<BlogEntityTag, { kind: "work" }>;
export type BlogContextCollab = Extract<BlogEntityTag, { kind: "collab" }>;
export type BlogContextGroup = Extract<BlogEntityTag, { kind: "group" }>;
export type BlogContextEvent = Extract<BlogEntityTag, { kind: "event" }>;
export type BlogContextPerson = Extract<BlogEntityTag, { kind: "profile" }>;
export type BlogContextPost = Extract<BlogEntityTag, { kind: "post" }>;

export type BlogPostContext = {
  /** Post type, derived Category, Fields, Subjects — the post's own taxonomy. */
  classification: BlogClassification;
  /** Human labels for the post's Fields, primary first. */
  fieldLabels: string[];
  works: BlogContextWork[];
  people: BlogContextPerson[];
  collabs: BlogContextCollab[];
  groups: BlogContextGroup[];
  events: BlogContextEvent[];
  /** Author-chosen Blog stories this post cites, continues, or recommends. */
  posts: BlogContextPost[];
  /** True when at least one linked entity exists. */
  hasEntities: boolean;
  /** True when there is taxonomy or a linked entity worth rendering. */
  hasContext: boolean;
};

export type DeriveBlogPostContextInput = {
  storyType?: string | null;
  storyTypes?: string[] | null;
  fields?: string[] | null;
  subjects?: string[] | null;
  /** Legacy routing mirror — only used to recover Fields on old rows. */
  categorySlug?: string | null;
  tags: BlogEntityTag[] | null | undefined;
  /** Byline profile ids — tagged people who are already credited above are dropped. */
  authorProfileIds?: Array<string | null | undefined>;
  authorUsernames?: Array<string | null | undefined>;
};

export function deriveBlogPostContext(input: DeriveBlogPostContextInput): BlogPostContext {
  const tags = input.tags ?? [];

  const classification = resolveBlogClassification({
    story_type: input.storyType ?? null,
    story_types: input.storyTypes ?? null,
    fields: input.fields ?? null,
    subjects: input.subjects ?? null,
    category_slug: input.categorySlug ?? null,
  });

  const works = tags.filter((t): t is BlogContextWork => t.kind === "work");
  const collabs = tags.filter((t): t is BlogContextCollab => t.kind === "collab");
  const groups = tags.filter((t): t is BlogContextGroup => t.kind === "group");
  const events = tags.filter((t): t is BlogContextEvent => t.kind === "event");
  const posts = tags.filter((t): t is BlogContextPost => t.kind === "post");

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

  const hasEntities =
    works.length > 0 ||
    people.length > 0 ||
    collabs.length > 0 ||
    groups.length > 0 ||
    events.length > 0 ||
    posts.length > 0;

  const hasTaxonomy =
    !!classification.postType ||
    classification.subjects.length > 0 ||
    classification.fields.some((f) => f !== "other");

  return {
    classification,
    fieldLabels: classification.fieldLabels,
    works,
    people,
    collabs,
    groups,
    events,
    posts,
    hasEntities,
    hasContext: hasEntities || hasTaxonomy,
  };
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
  for (const p of ctx.posts) push("BlogPosting", p.label, workshopEntityUrl({ kind: "post", slug: p.slug }));
  for (const e of ctx.events) push("Event", e.label, workshopEntityUrl({ kind: "event", groupSlug: e.groupSlug, slug: e.slug }));
  return nodes;
}

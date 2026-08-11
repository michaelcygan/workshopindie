/**
 * Shared model for structured Blog ↔ Workshop-entity tagging.
 * A blog post can be connected to Works, Collabs, Groups, Group Events,
 * and Profiles. Each tag is stored as one row in
 * `public.blog_post_entity_tags` with exactly one FK populated.
 *
 * This file is client-safe (no server imports).
 */

import { workshopEntityUrl, type WorkshopEntityRef } from "@/lib/entities/kinds";

export type BlogEntityKind = "work" | "collab" | "group" | "event" | "profile" | "post";

/**
 * Kinds an *entity page* can be the subject of in the reverse "From the Blog"
 * rails. Blog posts are valid tag targets but have no inbound rail in v1, so
 * that API stays deliberately narrower than `BlogEntityKind`.
 */
export type BlogRailSubjectKind = Exclude<BlogEntityKind, "post">;

export const BLOG_ENTITY_KIND_LABEL: Record<BlogEntityKind, string> = {
  work: "Work",
  collab: "Collab",
  group: "Group",
  event: "Event",
  profile: "Profile",
  post: "Post",
};

/** Editorial payload for a connected Blog post ("Related posts" row). */
export type BlogPostSummary = {
  excerpt: string | null;
  cover_url: string | null;
  author_name: string | null;
  published_at: string | null;
};

export type BlogWorkSummary = {
  excerpt: string | null;
  categories: string[];
  /** Free-form Work format ("Short film", "Remix", …). Absent on older Works. */
  subtype?: string | null;
  cover_url: string | null;
  cover_aspect: string | null;
  cover_focal_x: number | null;
  cover_focal_y: number | null;
  credits: Array<{
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    role_label: string | null;
  }>;
};

/**
 * A Blog tag *is* a Workshop entity reference. The only Blog-specific payload
 * is the Work summary the "About this post" cards render. `url` is optional so
 * unsaved, locally-constructed tags stay cheap to build; readers should use
 * `entityUrl()` which falls back to the canonical resolver.
 */
type BlogRefOf<K extends BlogEntityKind> = Omit<
  Extract<WorkshopEntityRef, { kind: K }>,
  "url" | "sublabel" | "image"
> & {
  url?: string;
  sublabel: string | null;
  image: string | null;
};

export type BlogEntityTag =
  | (BlogRefOf<"work"> & { work?: BlogWorkSummary | null })
  | BlogRefOf<"collab">
  | BlogRefOf<"group">
  | BlogRefOf<"event">
  | BlogRefOf<"profile">
  | (BlogRefOf<"post"> & { post?: BlogPostSummary | null });

/**
 * Blog tags are Workshop entity references with extra editorial payload, so
 * URLs and inline markdown come from the shared entity layer rather than a
 * second set of path templates.
 */
export function entityUrl(tag: BlogEntityTag): string {
  if (tag.url) return tag.url;
  switch (tag.kind) {
    case "profile":
      return workshopEntityUrl({ kind: "profile", username: tag.username });
    case "event":
      return workshopEntityUrl({ kind: "event", slug: tag.slug, groupSlug: tag.groupSlug });
    default:
      return workshopEntityUrl({ kind: tag.kind, slug: tag.slug });
  }
}

export function entityMarkdown(tag: BlogEntityTag): string {
  return `[${tag.label}](${entityUrl(tag)})`;
}

export function tagKey(tag: BlogEntityTag): string {
  return `${tag.kind}:${tag.id}`;
}

export function kindLabel(kind: BlogEntityKind): string {
  return BLOG_ENTITY_KIND_LABEL[kind];
}

export const MAX_BLOG_ENTITY_TAGS = 10;

type MinimalTag = { kind: BlogEntityKind; id: string };
type Invalidator = { invalidateQueries: (opts: { queryKey: unknown[] }) => unknown };

/**
 * Invalidate every reverse-discovery cache ("From the Blog" strips) affected by
 * a tag change. Pass both the previous and next tag sets so entities that were
 * just removed also refresh.
 */
export function invalidateEntityTagCaches(
  qc: Invalidator,
  ...tagSets: Array<MinimalTag[] | undefined | null>
) {
  const seen = new Set<string>();
  for (const set of tagSets) {
    for (const t of set ?? []) {
      const key = `${t.kind}:${t.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      qc.invalidateQueries({ queryKey: ["entity-blog-posts", t.kind, t.id] });
    }
  }
}

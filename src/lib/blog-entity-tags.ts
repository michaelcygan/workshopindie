/**
 * Shared model for structured Blog ↔ Workshop-entity tagging.
 * A blog post can be connected to Works, Collabs, Groups, Group Events,
 * and Profiles. Each tag is stored as one row in
 * `public.blog_post_entity_tags` with exactly one FK populated.
 *
 * This file is client-safe (no server imports).
 */

export type BlogEntityKind = "work" | "collab" | "group" | "event" | "profile";

export const BLOG_ENTITY_KIND_LABEL: Record<BlogEntityKind, string> = {
  work: "Work",
  collab: "Collab",
  group: "Group",
  event: "Event",
  profile: "Profile",
};

export type BlogWorkSummary = {
  excerpt: string | null;
  categories: string[];
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

export type BlogEntityTag =
  | {
      kind: "work";
      id: string;
      slug: string;
      label: string;
      sublabel: string | null;
      image: string | null;
      work?: BlogWorkSummary | null;
    }

  | {
      kind: "collab";
      id: string;
      slug: string;
      label: string;
      sublabel: string | null;
      image: string | null;
    }
  | {
      kind: "group";
      id: string;
      slug: string;
      label: string;
      sublabel: string | null;
      image: string | null;
    }
  | {
      kind: "event";
      id: string;
      slug: string;
      groupSlug: string;
      label: string;
      sublabel: string | null;
      image: string | null;
    }
  | {
      kind: "profile";
      id: string;
      username: string;
      label: string;
      sublabel: string | null;
      image: string | null;
    };

export function entityUrl(tag: BlogEntityTag): string {
  switch (tag.kind) {
    case "work":
      return `/works/${tag.slug}`;
    case "collab":
      return `/collab/${tag.slug}`;
    case "group":
      return `/g/${tag.slug}`;
    case "event":
      return `/g/${tag.groupSlug}/e/${tag.slug}`;
    case "profile":
      return `/u/${tag.username}`;
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


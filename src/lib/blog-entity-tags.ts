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

export type BlogEntityTag =
  | {
      kind: "work";
      id: string;
      slug: string;
      label: string;
      sublabel: string | null;
      image: string | null;
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

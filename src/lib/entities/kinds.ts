/**
 * The Workshop entity layer — shared vocabulary, not a new database object.
 *
 * Workshop primitives reference Workshop primitives in a dozen places (Blog
 * "About this post", Group tagging, Today, Lounge, DMs, reverse rails). Each
 * of those grew its own URL builder, label rule and chip. This module owns the
 * canonical *representation* and the canonical *URL*; the meaning of any given
 * relationship still lives in its own domain table.
 *
 * Client-safe: no server imports.
 */

export type WorkshopEntityKind = "profile" | "work" | "post" | "collab" | "group" | "event";

export const WORKSHOP_ENTITY_KINDS: readonly WorkshopEntityKind[] = [
  "profile",
  "work",
  "post",
  "collab",
  "group",
  "event",
] as const;

export const WORKSHOP_ENTITY_LABEL: Record<WorkshopEntityKind, string> = {
  profile: "Person",
  work: "Work",
  post: "Post",
  collab: "Collab",
  group: "Group",
  event: "Event",
};

/**
 * The minimum needed to build a canonical URL. Events are the only kind that
 * needs a second slug, because they live under their group.
 */
export type WorkshopEntityAddress =
  | { kind: "profile"; username: string }
  | { kind: "work"; slug: string }
  | { kind: "post"; slug: string }
  | { kind: "collab"; slug: string }
  | { kind: "group"; slug: string }
  | { kind: "event"; slug: string; groupSlug: string };

/** One canonical reference to something that exists on Workshop. */
export type WorkshopEntityRef = WorkshopEntityAddress & {
  id: string;
  label: string;
  url: string;
  image?: string | null;
  sublabel?: string | null;
};

/**
 * The one URL resolver. Every surface — chips, pickers, parsers, peeks,
 * markdown inserts — must route through this rather than templating paths.
 */
export function workshopEntityUrl(address: WorkshopEntityAddress): string {
  switch (address.kind) {
    case "profile":
      return `/${address.username}`;
    case "work":
      return `/works/${address.slug}`;
    case "post":
      return `/blog/${address.slug}`;
    case "collab":
      return `/collab/${address.slug}`;
    case "group":
      return `/g/${address.slug}`;
    case "event":
      return `/g/${address.groupSlug}/e/${address.slug}`;
  }
}

/** Build a full ref, filling in `url` from the address. */
export function makeEntityRef<A extends WorkshopEntityAddress>(
  address: A,
  rest: { id: string; label: string; image?: string | null; sublabel?: string | null },
): A & { id: string; label: string; url: string; image?: string | null; sublabel?: string | null } {
  return { ...address, ...rest, url: workshopEntityUrl(address) };
}

/**
 * The inline reference format Workshop already stores inside message bodies.
 * Kept identical to what existing messages contain so nothing re-renders
 * differently after the consolidation.
 */
export function entityMarkdown(ref: Pick<WorkshopEntityRef, "label" | "url">): string {
  return `[${ref.label}](${ref.url})`;
}

export function entityRefKey(ref: { kind: WorkshopEntityKind; id: string }): string {
  return `${ref.kind}:${ref.id}`;
}

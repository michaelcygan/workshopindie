import { EntityConnectionPicker } from "@/components/entity/entity-connection-picker";
import type { BlogEntityKind, BlogEntityTag } from "@/lib/blog-entity-tags";
import { tagKey } from "@/lib/blog-entity-tags";
import type { EntitySearchHit } from "@/lib/entities/search";

/**
 * Shared search hit -> the Blog's own tag shape. Blog tags carry an extra
 * `work` summary so the "About this post" panel can render mediums live from
 * the Work's subtype before the post is saved.
 */
function hitToBlogTag(hit: EntitySearchHit): BlogEntityTag {
  const common = {
    id: hit.id,
    label: hit.label,
    sublabel: hit.sublabel ?? null,
    image: hit.image ?? null,
  };
  switch (hit.kind) {
    case "work":
      return {
        kind: "work",
        slug: hit.slug,
        ...common,
        work: {
          excerpt: null,
          categories: hit.category ? [hit.category] : [],
          subtype: hit.subtype ?? null,
          cover_url: hit.image ?? null,
          cover_aspect: null,
          cover_focal_x: null,
          cover_focal_y: null,
          credits: [],
        },
      };
    case "collab":
      return { kind: "collab", slug: hit.slug, ...common };
    case "group":
      return { kind: "group", slug: hit.slug, ...common };
    case "event":
      return { kind: "event", slug: hit.slug, groupSlug: hit.groupSlug, ...common };
    case "profile":
      return { kind: "profile", username: hit.username, ...common };
    case "post":
      // The Blog picker never searches posts; keep the switch exhaustive.
      throw new Error("Blog posts are not taggable as post-context");
  }
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (tag: BlogEntityTag) => void;
  disabledKeys?: string[];
  title?: string;
  description?: string;
  /** Tab the picker opens on. Defaults to every kind. */
  initialKind?: BlogEntityKind | "all";
  /** Renders "Can't find it? Create a Work" in the Works group. */
  onRequestCreateWork?: () => void;
};

const BLOG_KINDS: readonly BlogEntityKind[] = ["work", "collab", "group", "event", "profile"];

/**
 * Blog-specific wrapper around the generic Workshop entity connection picker.
 *
 * The UI, search, and disabled-key behavior are shared with every other picker
 * in the app; the only Blog-specific bit is the transform to `BlogEntityTag`.
 */
export function BlogEntityTagPicker({
  open,
  onOpenChange,
  onPick,
  disabledKeys,
  title,
  description,
  initialKind = "all",
  onRequestCreateWork,
}: Props) {
  return (
    <EntityConnectionPicker
      open={open}
      onOpenChange={onOpenChange}
      onPick={(hit) => onPick(hitToBlogTag(hit))}
      disabledKeys={disabledKeys}
      title={title}
      description={description}
      initialKind={initialKind === "all" ? "all" : initialKind}
      kinds={BLOG_KINDS}
      onRequestCreateWork={onRequestCreateWork}
    />
  );
}

export { tagKey };


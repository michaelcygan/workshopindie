import { Link } from "@tanstack/react-router";
import { Briefcase, Users, MapPin, Calendar, User } from "lucide-react";
import type { BlogEntityKind, BlogEntityTag } from "@/lib/blog-entity-tags";

const KIND_ICONS: Record<BlogEntityKind, typeof Briefcase> = {
  work: Briefcase,
  collab: Users,
  group: MapPin,
  event: Calendar,
  profile: User,
};

function ChipInner({ tag }: { tag: BlogEntityTag }) {
  const Icon = KIND_ICONS[tag.kind];
  return (
    <>
      <Icon className="h-3.5 w-3.5 text-ink-muted" />
      <span className="truncate">{tag.label}</span>
    </>
  );
}

/**
 * Renders a "Connected to" chip strip below a post's byline. Chips link into
 * the tagged entity. If `tags` is empty, renders nothing.
 */
export function BlogEntityTags({
  tags,
  className,
  label = "Connected to",
}: {
  tags: BlogEntityTag[];
  className?: string;
  label?: string;
}) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className={className}>
      <div className="mb-1 text-[11px] uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => {
          const className =
            "inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-ink hover:bg-muted";
          if (tag.kind === "work") {
            return (
              <Link key={`${tag.kind}:${tag.id}`} to="/works/$slug" params={{ slug: tag.slug }} className={className}>
                <ChipInner tag={tag} />
              </Link>
            );
          }
          if (tag.kind === "collab") {
            return (
              <Link key={`${tag.kind}:${tag.id}`} to="/collab/$slug" params={{ slug: tag.slug }} className={className}>
                <ChipInner tag={tag} />
              </Link>
            );
          }
          if (tag.kind === "group") {
            return (
              <Link key={`${tag.kind}:${tag.id}`} to="/g/$slug" params={{ slug: tag.slug }} className={className}>
                <ChipInner tag={tag} />
              </Link>
            );
          }
          if (tag.kind === "event") {
            return (
              <Link
                key={`${tag.kind}:${tag.id}`}
                to="/g/$slug/e/$eventSlug"
                params={{ slug: tag.groupSlug, eventSlug: tag.slug }}
                className={className}
              >
                <ChipInner tag={tag} />
              </Link>
            );
          }
          return (
            <Link
              key={`${tag.kind}:${tag.id}`}
              to="/u/$username"
              params={{ username: tag.username }}
              className={className}
            >
              <ChipInner tag={tag} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

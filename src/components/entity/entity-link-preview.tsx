import { lazy, Suspense, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { GroupPeek } from "@/components/group-peek";
import { EventPeek } from "@/components/event-peek";
import { CollabPeek } from "@/components/collab-peek";
import { WorkPeek } from "@/components/work-peek";
import { ProfilePeek } from "@/components/profile-peek";
import { useEntityIdBySlug, useProfileIdByUsername } from "@/lib/entities/use-entity-id";
import { WorkGlance, CollabGlance, PostGlance } from "@/components/entity/entity-glance";
import { workshopEntityUrl, type WorkshopEntityAddress } from "@/lib/entities/kinds";

// Lazy: BlogPostPeek renders BlogPostBody, which renders this component.
const BlogPostPeek = lazy(() =>
  import("@/components/blog-post-peek").then((m) => ({ default: m.BlogPostPeek })),
);

/**
 * Wrap any link-shaped node so a Workshop reference previews in place.
 *
 * Editorial prose links stay visually untouched — the preview is additive.
 * Group / Event / Person previews are hover cards on desktop and drawers on
 * touch; Work / Collab / Post previews open a dialog on click, matching the
 * inline reference chips used elsewhere in the product.
 */
export function EntityLinkPreview({
  address,
  className,
  children,
}: {
  address: WorkshopEntityAddress;
  className?: string;
  children: ReactNode;
}) {
  if (address.kind === "group") {
    return (
      <GroupPeek slug={address.slug}>
        <Link to="/g/$slug" params={{ slug: address.slug }} className={className}>
          {children}
        </Link>
      </GroupPeek>
    );
  }
  if (address.kind === "event") {
    return (
      <EventPeek groupSlug={address.groupSlug} eventSlug={address.slug}>
        <Link
          to="/g/$slug/e/$eventSlug"
          params={{ slug: address.groupSlug, eventSlug: address.slug }}
          className={className}
        >
          {children}
        </Link>
      </EventPeek>
    );
  }
  if (address.kind === "profile") {
    return (
      <ProfileLinkPreview username={address.username} className={className}>
        {children}
      </ProfileLinkPreview>
    );
  }
  if (address.kind === "work") {
    return (
      <SlugDialogPreview kind="work" slug={address.slug} className={className}>
        {children}
      </SlugDialogPreview>
    );
  }
  if (address.kind === "collab") {
    return (
      <SlugDialogPreview kind="collab" slug={address.slug} className={className}>
        {children}
      </SlugDialogPreview>
    );
  }
  return (
    <PostLinkPreview slug={address.slug} className={className}>
      {children}
    </PostLinkPreview>
  );
}

function ProfileLinkPreview({
  username,
  className,
  children,
}: {
  username: string;
  className?: string;
  children: ReactNode;
}) {
  const [armed, setArmed] = useState(false);
  const { data: id } = useProfileIdByUsername(username, armed);
  const link = (
    <Link
      to="/$username"
      params={{ username }}
      className={className}
      onMouseEnter={() => setArmed(true)}
      onFocus={() => setArmed(true)}
      onTouchStart={() => setArmed(true)}
    >
      {children}
    </Link>
  );
  if (!id) return link;
  return <ProfilePeek userId={id}>{link}</ProfilePeek>;
}

function SlugDialogPreview({
  kind,
  slug,
  className,
  children,
}: {
  kind: "work" | "collab";
  slug: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  // The id lookup is needed for the dialog and for the collab glance.
  const { data: id } = useEntityIdBySlug(
    kind === "work" ? "works" : "collab_posts",
    slug,
    open || (kind === "collab" && armed),
  );
  const anchor = (
    <a
      href={workshopEntityUrl(kind === "work" ? { kind: "work", slug } : { kind: "collab", slug })}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        setOpen(true);
      }}
    >
      {children}
    </a>
  );
  const arm = () => setArmed(true);
  return (
    <>
      {kind === "work" ? (
        <WorkGlance slug={slug} armed={armed} onArm={arm}>
          {anchor}
        </WorkGlance>
      ) : (
        <CollabGlance collabId={armed ? (id ?? null) : null} onArm={arm}>
          {anchor}
        </CollabGlance>
      )}
      {kind === "work" ? (
        <WorkPeek workId={id ?? null} open={open} onOpenChange={setOpen} />
      ) : (
        <CollabPeek collabId={id ?? null} open={open} onOpenChange={setOpen} />
      )}
    </>
  );
}

function PostLinkPreview({
  slug,
  className,
  children,
}: {
  slug: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  return (
    <>
      <PostGlance slug={slug} armed={armed} onArm={() => setArmed(true)}>
        <a
          href={workshopEntityUrl({ kind: "post", slug })}
          className={className}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
        >
          {children}
        </a>
      </PostGlance>
      {open ? (
        <Suspense fallback={null}>
          <BlogPostPeek slug={slug} open={open} onOpenChange={setOpen} />
        </Suspense>
      ) : null}
    </>
  );
}


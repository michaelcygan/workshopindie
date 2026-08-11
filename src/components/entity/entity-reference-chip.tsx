import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpen, Calendar, Image as ImageIcon, Megaphone, User, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GroupPeek } from "@/components/group-peek";
import { EventPeek } from "@/components/event-peek";
import { CollabPeek } from "@/components/collab-peek";
import { WorkPeek } from "@/components/work-peek";
import { BlogPostPeek } from "@/components/blog-post-peek";
import { ProfilePeek } from "@/components/profile-peek";
import type { InlineEntityKind } from "@/lib/entities/parse";
import { useEntityIdBySlug } from "@/lib/entities/use-entity-id";

export type ChipEntityKind = InlineEntityKind | "profile";

/**
 * The one inline Workshop reference chip.
 *
 * Every conversational surface (Today, Lounge, DMs) renders references through
 * this component, so a Work looks and behaves the same wherever it is
 * mentioned. Visual language is unchanged — this is the Today board's mature
 * pill treatment, promoted to shared infrastructure.
 */

const CHIP_BASE =
  "mx-0.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 align-baseline text-[12px] font-medium";

const CHIP_TONE: Record<ChipEntityKind, string> = {
  work: "border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10",
  collab: "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10",
  group: "border-signal/30 bg-signal/5 text-signal hover:bg-signal/10",
  event: "border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10",
  post: "border-signal/30 bg-signal/5 text-signal hover:bg-signal/10",
  profile: "border-ink-muted/30 bg-surface text-ink hover:bg-muted",
};

const CHIP_ICON: Record<ChipEntityKind, typeof Users> = {
  work: ImageIcon,
  collab: Megaphone,
  group: Users,
  event: Calendar,
  post: BookOpen,
  profile: User,
};

function chipClass(kind: ChipEntityKind) {
  return `${CHIP_BASE} ${CHIP_TONE[kind]}`;
}

function ChipLabel({ kind, label }: { kind: ChipEntityKind; label: string }) {
  const Icon = CHIP_ICON[kind];
  return (
    <>
      <Icon className="h-3 w-3" />
      {label}
    </>
  );
}

function WorkChip({ label, slug }: { label: string; slug: string }) {
  const [open, setOpen] = useState(false);
  const { data: id } = useEntityIdBySlug("works", slug, open);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={chipClass("work")}
      >
        <ChipLabel kind="work" label={label} />
      </button>
      <WorkPeek workId={id ?? null} open={open} onOpenChange={setOpen} />
    </>
  );
}

function CollabChip({ label, slug }: { label: string; slug: string }) {
  const [open, setOpen] = useState(false);
  const { data: id } = useEntityIdBySlug("collab_posts", slug, open);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={chipClass("collab")}
      >
        <ChipLabel kind="collab" label={label} />
      </button>
      <CollabPeek collabId={id ?? null} open={open} onOpenChange={setOpen} />
    </>
  );
}

function PostChip({ label, slug }: { label: string; slug: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={chipClass("post")}
      >
        <ChipLabel kind="post" label={label} />
      </button>
      <BlogPostPeek slug={slug} open={open} onOpenChange={setOpen} />
    </>
  );
}

function ProfileChip({ label, username, userId }: { label: string; username: string; userId: string }) {
  return (
    <ProfilePeek userId={userId}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
        }}
        className={chipClass("profile")}
      >
        <ChipLabel kind="profile" label={label} />
      </button>
    </ProfilePeek>
  );
}


export function EntityReferenceChip({
  kind,
  label,
  slug,
  groupSlug,
  id,
}: {
  kind: ChipEntityKind;
  label: string;
  slug: string;
  groupSlug?: string;
  id?: string;
}) {
  if (kind === "profile") {
    if (!id) return <span className={chipClass("profile")}>{label}</span>;
    return <ProfileChip label={label} username={slug} userId={id} />;
  }
  if (kind === "work") return <WorkChip label={label} slug={slug} />;
  if (kind === "collab") return <CollabChip label={label} slug={slug} />;
  if (kind === "post") return <PostChip label={label} slug={slug} />;
  if (kind === "group") {
    return (
      <GroupPeek slug={slug}>
        <Link to="/g/$slug" params={{ slug }} className={chipClass("group")}>
          <ChipLabel kind="group" label={label} />
        </Link>
      </GroupPeek>
    );
  }
  if (!groupSlug) return null;
  return (
    <EventPeek groupSlug={groupSlug} eventSlug={slug}>
      <Link
        to="/g/$slug/e/$eventSlug"
        params={{ slug: groupSlug, eventSlug: slug }}
        className={chipClass("event")}
      >
        <ChipLabel kind="event" label={label} />
      </Link>
    </EventPeek>
  );
}

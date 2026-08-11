import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { BlogWorkSummary } from "@/lib/blog-entity-tags";
import {
  type BlogContextEvent,
  type BlogContextGroup,
  type BlogContextCollab,
  type BlogContextPerson,
  type BlogContextWork,
  type BlogPostContext as PostContext,
} from "@/lib/blog-post-context";

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

function initial(s: string | null | undefined) {
  return (s || "?").slice(0, 1).toUpperCase();
}

/** One colophon row: quiet label column, content column. Stacks on mobile. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1.5 py-4 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-6 sm:py-5">
      <div className="pt-0.5 text-[11px] uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function WorkEntry({ tag }: { tag: BlogContextWork }) {
  const w = (tag as { work?: BlogWorkSummary | null }).work ?? null;
  const credits = (w?.credits ?? []).filter((c) => c.display_name || c.username);
  const [open, setOpen] = useState(false);
  const { data: workId } = useEntityIdBySlug("works", tag.slug, open);
  const meta = [
    w?.subtype ? titleCase(w.subtype) : null,
    ...(w?.categories ?? []).slice(0, 2).map(titleCase),
  ].filter(Boolean);

  return (
    <div className="min-w-0">
    <Link
      to="/works/$slug"
      params={{ slug: tag.slug }}
      className="group flex flex-col gap-3 sm:flex-row sm:gap-4"
    >

      {w?.cover_url ? (
        <img
          src={w.cover_url}
          alt=""
          loading="lazy"
          decoding="async"
          className="aspect-[16/10] w-full shrink-0 rounded-xl bg-muted object-cover sm:w-36"
          style={{
            objectPosition:
              w.cover_focal_x != null && w.cover_focal_y != null
                ? `${w.cover_focal_x}% ${w.cover_focal_y}%`
                : undefined,
          }}
        />
      ) : null}

      <div className="min-w-0 flex-1">
        {meta.length > 0 && (
          <div className="text-[11px] uppercase tracking-wider text-ink-muted">
            {meta.join(" · ")}
          </div>
        )}
        <div className="mt-0.5 font-display text-lg leading-snug text-ink group-hover:underline">
          {tag.label}
        </div>
        {w?.excerpt && <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{w.excerpt}</p>}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {credits.length > 0 && (
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex -space-x-2">
                {credits.map((c) => (
                  <Avatar key={c.id} className="h-5 w-5 border border-surface">
                    {c.avatar_url ? <AvatarImage src={c.avatar_url} alt="" /> : null}
                    <AvatarFallback className="text-[9px]">
                      {initial(c.display_name || c.username)}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <span className="truncate text-xs text-ink-muted">
                {credits
                  .map((c) => (c.display_name || c.username) + (c.role_label ? ` · ${c.role_label}` : ""))
                  .join(", ")}
              </span>
            </div>
          )}
          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-soft group-hover:text-ink">
            View Work <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function PersonEntry({ tag }: { tag: BlogContextPerson }) {
  return (
    <div className="flex items-center gap-3">
      <ProfilePeek userId={tag.id}>
        <Link
          to="/$username"
          params={{ username: tag.username }}
          className="group flex min-w-0 flex-1 items-center gap-3"
        >
          <Avatar className="h-8 w-8 shrink-0">
            {tag.image ? <AvatarImage src={tag.image} alt="" /> : null}
            <AvatarFallback className="text-[10px]">{initial(tag.label)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate text-sm text-ink group-hover:underline">{tag.label}</div>
            {tag.sublabel && (
              <div className="truncate text-xs text-ink-muted">{tag.sublabel}</div>
            )}
          </div>
        </Link>
      </ProfilePeek>
      <div className="shrink-0">
        <FollowButton targetUserId={tag.id} targetName={tag.label} />
      </div>
    </div>
  );
}

function GroupEntry({ tag }: { tag: BlogContextGroup }) {
  return (
    <GroupPeek slug={tag.slug}>
      <Link to="/g/$slug" params={{ slug: tag.slug }} className="group flex items-center gap-3">
        <Avatar className="h-8 w-8 shrink-0 rounded-lg">
          {tag.image ? <AvatarImage src={tag.image} alt="" className="rounded-lg" /> : null}
          <AvatarFallback className="rounded-lg text-[10px]">{initial(tag.label)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="truncate text-sm text-ink group-hover:underline">{tag.label}</div>
          {tag.sublabel && <div className="truncate text-xs text-ink-muted">{tag.sublabel}</div>}
        </div>
      </Link>
    </GroupPeek>
  );
}

function CollabEntry({ tag }: { tag: BlogContextCollab }) {
  const [open, setOpen] = useState(false);
  const { data: id } = useEntityIdBySlug("collab_posts", tag.slug, open);
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-1.5">
        <Link to="/collab/$slug" params={{ slug: tag.slug }} className="group min-w-0">
          <span className="truncate text-sm text-ink group-hover:underline">{tag.label}</span>
        </Link>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 text-xs text-ink-muted underline decoration-border underline-offset-4 hover:text-ink"
        >
          Preview
        </button>
      </div>
      {tag.sublabel && <div className="line-clamp-1 text-xs text-ink-muted">{tag.sublabel}</div>}
      <CollabPeek collabId={id ?? null} open={open} onOpenChange={setOpen} />
    </div>
  );
}


function EventEntry({ tag }: { tag: BlogContextEvent }) {
  return (
    <EventPeek groupSlug={tag.groupSlug} eventSlug={tag.slug}>
      <Link
        to="/g/$slug/e/$eventSlug"
        params={{ slug: tag.groupSlug, eventSlug: tag.slug }}
        className="group flex min-w-0 items-center gap-3"
      >
        {tag.image ? (
          <img
            src={tag.image}
            alt=""
            loading="lazy"
            className="h-10 w-14 shrink-0 rounded-lg bg-muted object-cover"
          />
        ) : null}
        <div className="min-w-0">
          <div className="truncate text-sm text-ink group-hover:underline">{tag.label}</div>
          {tag.sublabel && <div className="truncate text-xs text-ink-muted">{tag.sublabel}</div>}
        </div>
      </Link>
    </EventPeek>
  );
}


/**
 * "About this post" — the public expression of a Blog post's structured
 * creative graph. Renders as a colophon after the article body; groups with no
 * content never render, and the whole section hides when a post has no
 * relationships beyond its editorial category.
 */
export function BlogPostContext({
  context,
  className,
}: {
  context: PostContext;
  className?: string;
}) {
  if (!context.hasContext) return null;
  const cat = context.editorialCategory;

  return (
    <section className={className ?? "mt-14"} aria-labelledby="about-this-post">
      <h2
        id="about-this-post"
        className="text-[11px] uppercase tracking-[0.18em] text-ink-muted"
      >
        About this post
      </h2>

      <div className="mt-2 divide-y divide-border border-t border-border">
        <Row label="Category">
          <Link
            to="/blog/c/$category"
            params={{ category: cat.slug }}
            className="text-sm text-ink underline decoration-border underline-offset-4 hover:decoration-primary"
          >
            {cat.label}
          </Link>
        </Row>

        {context.mediums.length > 0 && (
          <Row label={context.mediums.length === 1 ? "Medium" : "Mediums"}>
            <div className="text-sm text-ink-soft">{context.mediums.join(" · ")}</div>
          </Row>
        )}

        {context.works.length > 0 && (
          <Row label={context.works.length === 1 ? "Work" : "Works"}>
            <div className="grid gap-5">
              {context.works.map((w) => (
                <WorkEntry key={w.id} tag={w} />
              ))}
            </div>
          </Row>
        )}

        {context.people.length > 0 && (
          <Row label="People">
            <div className="grid gap-3">
              {context.people.map((p) => (
                <PersonEntry key={p.id} tag={p} />
              ))}
            </div>
          </Row>
        )}

        {context.collabs.length > 0 && (
          <Row label={context.collabs.length === 1 ? "Collab" : "Collabs"}>
            <div className="grid gap-3">
              {context.collabs.map((c) => (
                <CollabEntry key={c.id} tag={c} />
              ))}
            </div>
          </Row>
        )}

        {context.groups.length > 0 && (
          <Row label={context.groups.length === 1 ? "Group" : "Groups"}>
            <div className="grid gap-3">
              {context.groups.map((g) => (
                <GroupEntry key={g.id} tag={g} />
              ))}
            </div>
          </Row>
        )}

        {context.events.length > 0 && (
          <Row label={context.events.length === 1 ? "Event" : "Events"}>
            <div className="grid gap-3">
              {context.events.map((e) => (
                <EventEntry key={e.id} tag={e} />
              ))}
            </div>
          </Row>
        )}
      </div>
    </section>
  );
}

export type { BlogContextEvent };

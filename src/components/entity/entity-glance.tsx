/**
 * Desktop hover "glance" for editorial prose references.
 *
 * Group / Event / Person links already peek on hover; Work, Collab and Post
 * links previously only responded to a click. This wrapper gives them the same
 * two-speed behaviour: hover for a glance, click for the full dialog. Data is
 * fetched with the exact query keys the dialogs use, so opening the dialog
 * after a hover costs nothing extra.
 */
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useIsMobile } from "@/hooks/use-mobile";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryChipsCompact } from "@/components/category-chips";
import { supabase } from "@/integrations/supabase/client";
import { getWorkPeekDetail } from "@/lib/works-peek.functions";
import { collabPeekQueryOptions } from "@/components/collab-peek";
import { formatCount } from "@/lib/utils";
import type { Category } from "@/lib/categories";

type GlanceProps = {
  /** Arm the lookup only once the pointer/focus lands on the link. */
  onArm: () => void;
  children: ReactNode;
};

function GlanceShell({ onArm, children, body }: GlanceProps & { body: ReactNode }) {
  const isMobile = useIsMobile();
  if (isMobile) return <>{children}</>;
  return (
    <HoverCard openDelay={140} closeDelay={120}>
      <HoverCardTrigger asChild onMouseEnter={onArm} onFocus={onArm}>
        {children}
      </HoverCardTrigger>
      <HoverCardContent className="w-72 overflow-hidden p-0" align="start" sideOffset={8}>
        {body}
      </HoverCardContent>
    </HoverCard>
  );
}

function GlanceSkeleton() {
  return (
    <div className="space-y-2 p-3" aria-busy="true">
      <Skeleton className="h-20 w-full rounded" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-full" />
    </div>
  );
}

function GlanceCard({
  cover,
  eyebrow,
  title,
  excerpt,
  meta,
}: {
  cover?: string | null;
  eyebrow?: ReactNode;
  title: string;
  excerpt?: string | null;
  meta?: ReactNode;
}) {
  return (
    <div>
      {cover ? (
        <div className="h-24 w-full bg-surface-2">
          <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" />
        </div>
      ) : null}
      <div className="space-y-1.5 p-3">
        {eyebrow ? <div className="flex flex-wrap gap-1">{eyebrow}</div> : null}
        <p className="text-sm font-medium leading-snug text-ink line-clamp-2">{title}</p>
        {excerpt ? <p className="text-xs leading-relaxed text-ink-muted line-clamp-2">{excerpt}</p> : null}
        {meta ? <div className="pt-0.5 text-[11px] text-ink-muted">{meta}</div> : null}
        <p className="pt-1 text-[11px] font-medium text-ink-muted">Click to open preview</p>
      </div>
    </div>
  );
}

export function WorkGlance({ workId, onArm, children }: { workId: string | null } & GlanceProps) {
  const fetchPeek = useServerFn(getWorkPeekDetail);
  const { data, isLoading } = useQuery({
    queryKey: ["work-peek", workId],
    queryFn: () => fetchPeek({ data: { workId: workId! } }),
    enabled: !!workId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
  const work = (data as any)?.work ?? null;
  const body = isLoading || !workId ? (
    <GlanceSkeleton />
  ) : !work ? (
    <div className="p-3 text-xs text-ink-muted">Preview unavailable.</div>
  ) : (
    <GlanceCard
      cover={work.cover_url}
      eyebrow={<CategoryChipsCompact primary={work.category as Category} categories={work.categories} />}
      title={work.title}
      excerpt={work.excerpt || work.description}
      meta={
        <span>
          {formatCount(work.like_count ?? 0)} likes · {formatCount(work.view_count ?? 0)} views
        </span>
      }
    />
  );
  return (
    <GlanceShell onArm={onArm} body={body}>
      {children}
    </GlanceShell>
  );
}

export function CollabGlance({ collabId, onArm, children }: { collabId: string | null } & GlanceProps) {
  const { data, isLoading } = useQuery(collabPeekQueryOptions(collabId));
  const collab = data?.collab ?? null;
  const openRoles = collab?.roles?.reduce((n, r) => n + (r.quantity ?? 1), 0) ?? 0;
  const body = isLoading || !collabId ? (
    <GlanceSkeleton />
  ) : !collab ? (
    <div className="p-3 text-xs text-ink-muted">Preview unavailable.</div>
  ) : (
    <GlanceCard
      eyebrow={<CategoryChipsCompact primary={collab.category} categories={collab.categories} />}
      title={collab.title}
      excerpt={collab.description}
      meta={openRoles > 0 ? <span>{openRoles} open role{openRoles === 1 ? "" : "s"}</span> : null}
    />
  );
  return (
    <GlanceShell onArm={onArm} body={body}>
      {children}
    </GlanceShell>
  );
}

type PostSummary = { title: string; excerpt: string | null; cover_image_url: string | null };

export function PostGlance({ slug, armed, onArm, children }: { slug: string; armed: boolean } & GlanceProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["blog-peek-summary", slug],
    enabled: armed,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PostSummary | null> => {
      const { data: row } = await supabase
        .from("blog_posts")
        .select("title,excerpt,cover_image_url")
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();
      return (row as PostSummary | null) ?? null;
    },
  });
  const body = isLoading || !armed ? (
    <GlanceSkeleton />
  ) : !data ? (
    <div className="p-3 text-xs text-ink-muted">Preview unavailable.</div>
  ) : (
    <GlanceCard cover={data.cover_image_url} title={data.title} excerpt={data.excerpt} />
  );
  return (
    <GlanceShell onArm={onArm} body={body}>
      {children}
    </GlanceShell>
  );
}

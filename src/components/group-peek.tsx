import { type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ExternalLink, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCount } from "@/lib/utils";

type PeekGroup = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  member_count: number | null;
};

async function fetchGroup(slug: string): Promise<PeekGroup | null> {
  const { data } = await supabase
    .from("groups")
    .select("id,slug,name,tagline,avatar_url,cover_url,member_count")
    .eq("slug", slug)
    .maybeSingle();
  return (data as PeekGroup | null) ?? null;
}

export function groupPeekQueryOptions(slug: string) {
  return {
    queryKey: ["group-peek", slug] as const,
    queryFn: () => fetchGroup(slug),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  };
}

/**
 * Hover / tap peek for a Group. Renders `children` as the trigger; opens
 * a small info card with cover, name, tagline, member count, and a link
 * to the group page.
 */
export function GroupPeek({ slug, children }: { slug: string; children: ReactNode }) {
  const isMobile = useIsMobile();
  const body = <Body slug={slug} />;
  if (isMobile) {
    return (
      <Drawer>
        <DrawerTrigger asChild>{children}</DrawerTrigger>
        <DrawerContent className="px-4 pb-6">
          <DrawerTitle className="sr-only">Group</DrawerTitle>
          <div className="mx-auto w-full max-w-md pt-3">{body}</div>
        </DrawerContent>
      </Drawer>
    );
  }
  return (
    <HoverCard openDelay={120} closeDelay={120}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-72 overflow-hidden p-0" align="start" sideOffset={8}>
        {body}
      </HoverCardContent>
    </HoverCard>
  );
}

function Body({ slug }: { slug: string }) {
  const { data, isLoading } = useQuery(groupPeekQueryOptions(slug));

  if (isLoading) {
    return (
      <div className="p-4 space-y-3" aria-busy="true">
        <Skeleton className="h-12 w-full rounded" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-full" />
      </div>
    );
  }
  if (!data) {
    return <div className="p-4 text-xs text-ink-muted">Group unavailable.</div>;
  }
  return (
    <div>
      {data.cover_url ? (
        <div className="h-20 w-full bg-muted">
          <img src={data.cover_url} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="h-12 w-full gradient-soft" />
      )}
      <div className="p-4 space-y-2">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted -mt-6 ring-2 ring-popover">
            {data.avatar_url ? (
              <img src={data.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-ink-muted">
                <Users className="h-4 w-4" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-base text-ink truncate">{data.name}</div>
            {data.tagline && (
              <div className="text-xs text-ink-soft line-clamp-2">{data.tagline}</div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between text-[11px] text-ink-muted">
          <span>
            <b className="text-ink">{formatCount(data.member_count ?? 0)}</b> members
          </span>
          <Link
            to="/g/$slug"
            params={{ slug: data.slug }}
            className="inline-flex items-center gap-1 text-ink-muted hover:text-ink"
          >
            View group <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

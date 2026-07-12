import { type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Calendar, ExternalLink, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";

type PeekEvent = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  cover_url: string | null;
  starts_at: string;
  venue_name: string | null;
  online_url: string | null;
  going_count: number | null;
  group: { slug: string; name: string } | null;
};

async function fetchEvent(groupSlug: string, eventSlug: string): Promise<PeekEvent | null> {
  const { data: group } = await supabase
    .from("groups")
    .select("id,slug,name")
    .eq("slug", groupSlug)
    .maybeSingle();
  if (!group) return null;
  const { data } = await supabase
    .from("group_events")
    .select(
      "id,slug,title,tagline,cover_url,starts_at,venue_name,online_url,going_count",
    )
    .eq("group_id", group.id)
    .eq("slug", eventSlug)
    .maybeSingle();
  if (!data) return null;
  return {
    ...(data as Omit<PeekEvent, "group">),
    group: { slug: group.slug, name: group.name },
  };
}

export function eventPeekQueryOptions(groupSlug: string, eventSlug: string) {
  return {
    queryKey: ["event-peek", groupSlug, eventSlug] as const,
    queryFn: () => fetchEvent(groupSlug, eventSlug),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  };
}

/**
 * Hover / tap peek for a Group Event.
 */
export function EventPeek({
  groupSlug,
  eventSlug,
  children,
}: {
  groupSlug: string;
  eventSlug: string;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();
  const body = <Body groupSlug={groupSlug} eventSlug={eventSlug} />;
  if (isMobile) {
    return (
      <Drawer>
        <DrawerTrigger asChild>{children}</DrawerTrigger>
        <DrawerContent className="px-4 pb-6">
          <DrawerTitle className="sr-only">Event</DrawerTitle>
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

function Body({ groupSlug, eventSlug }: { groupSlug: string; eventSlug: string }) {
  const { data, isLoading } = useQuery(eventPeekQueryOptions(groupSlug, eventSlug));
  if (isLoading) {
    return (
      <div className="p-4 space-y-3" aria-busy="true">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    );
  }
  if (!data) return <div className="p-4 text-xs text-ink-muted">Event unavailable.</div>;
  const when = new Date(data.starts_at).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const where = data.venue_name || (data.online_url ? "Online" : null);
  return (
    <div>
      {data.cover_url && (
        <div className="h-24 w-full bg-muted">
          <img src={data.cover_url} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <div className="p-4 space-y-2">
        <div className="font-display text-base text-ink line-clamp-2">{data.title}</div>
        {data.group && (
          <div className="text-[11px] text-ink-muted">in {data.group.name}</div>
        )}
        <div className="flex items-center gap-1.5 text-xs text-ink-soft">
          <Calendar className="h-3.5 w-3.5 text-ink-muted" />
          <span>{when}</span>
        </div>
        {where && (
          <div className="flex items-center gap-1.5 text-xs text-ink-soft">
            <MapPin className="h-3.5 w-3.5 text-ink-muted" />
            <span className="truncate">{where}</span>
          </div>
        )}
        {data.tagline && <p className="text-xs text-ink-soft line-clamp-2">{data.tagline}</p>}
        <div className="flex items-center justify-between pt-1 text-[11px] text-ink-muted">
          <span>
            <b className="text-ink">{data.going_count ?? 0}</b> going
          </span>
          {data.group && (
            <Link
              to="/g/$slug/e/$eventSlug"
              params={{ slug: data.group.slug, eventSlug: data.slug }}
              className="inline-flex items-center gap-1 text-ink-muted hover:text-ink"
            >
              View event <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

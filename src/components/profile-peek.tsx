import { type ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { FollowButton } from "@/components/follow-button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCount } from "@/lib/utils";

export type PeekProfile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  follower_count: number;
  following_count: number;
  work_count: number;
};

export type PeekWork = {
  id: string;
  title: string;
  slug: string;
  cover_url: string | null;
};

async function fetchPeek(userId: string): Promise<{ profile: PeekProfile; works: PeekWork[] } | null> {
  const [{ data: profile }, { data: works }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,display_name,username,avatar_url,headline,bio,follower_count,following_count,work_count")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("works")
      .select("id,title,slug,cover_url,published_at")
      .eq("created_by", userId)
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(6),
  ]);
  if (!profile) return null;
  return { profile: profile as PeekProfile, works: (works ?? []) as PeekWork[] };
}

export function profilePeekQueryOptions(userId: string) {
  return {
    queryKey: ["profile-peek", userId] as const,
    queryFn: () => fetchPeek(userId),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  };
}

export function ProfilePeek({
  userId,
  speaking,
  children,
  onWorkClick,
  onOpenChange,
  roomId,
}: {
  userId: string;
  speaking?: boolean;
  children: ReactNode;
  onWorkClick?: (workId: string) => void;
  onOpenChange?: (open: boolean) => void;
  roomId?: string;
}) {
  const isMobile = useIsMobile();

  const body = (close: () => void) => (
    <PeekBody userId={userId} speaking={speaking} roomId={roomId} onWorkClick={(id) => { onWorkClick?.(id); close(); }} />
  );

  if (isMobile) {
    return (
      <Drawer onOpenChange={onOpenChange}>
        <DrawerTrigger asChild>{children}</DrawerTrigger>
        <DrawerContent className="px-4 pb-6">
          <DrawerTitle className="sr-only">Profile</DrawerTitle>
          <div className="mx-auto w-full max-w-md pt-3">{body(() => onOpenChange?.(false))}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <HoverCard openDelay={120} closeDelay={120} onOpenChange={onOpenChange}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-80 p-0 overflow-hidden" align="start" sideOffset={8}>
        {body(() => onOpenChange?.(false))}
      </HoverCardContent>
    </HoverCard>
  );
}

function PeekBody({
  userId,
  speaking,
  onWorkClick,
  roomId,
}: {
  userId: string;
  speaking?: boolean;
  onWorkClick?: (workId: string) => void;
  roomId?: string;
}) {
  const { data, isLoading } = useQuery(profilePeekQueryOptions(userId));

  if (isLoading) {
    return (
      <div className="p-4 space-y-3" aria-busy="true">
        <div className="flex items-start gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-8 w-28 rounded-full" />
      </div>
    );
  }
  if (!data) {
    return <div className="p-4 text-xs text-ink-muted">Profile unavailable.</div>;
  }
  const { profile, works } = data;
  const display = profile.display_name || profile.username || "Anon";

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className={cn(
            "relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted",
            speaking && "ring-2 ring-primary ring-offset-2 ring-offset-background",
          )}>
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-sm text-ink-muted">
                {(display[0] || "?").toUpperCase()}
              </span>
            )}
            {speaking && (
              <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-3 w-3">
                <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-70" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5 truncate">
              <span className="font-display text-base text-ink truncate">{display}</span>
            </div>
            {profile.username && (
              <div className="text-[11px] text-ink-muted truncate">@{profile.username}</div>
            )}
            {profile.headline && (
              <div className="mt-0.5 text-xs text-ink-soft line-clamp-2">{profile.headline}</div>
            )}
          </div>
        </div>

        {profile.bio && (
          <p className="text-xs text-ink-soft line-clamp-3">{profile.bio}</p>
        )}

        <div className="flex items-center gap-3 text-[11px] text-ink-muted">
          <span><b className="text-ink">{formatCount(profile.follower_count)}</b> followers</span>
          <span><b className="text-ink">{formatCount(profile.following_count)}</b> following</span>
          <span><b className="text-ink">{formatCount(profile.work_count)}</b> works</span>
        </div>

        <div className="flex items-center gap-2">
          <FollowButton targetUserId={profile.id} roomId={roomId} />
          {profile.username && (
            <a
              href={`/u/${profile.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-ink-muted hover:text-ink transition"
            >
              Full profile <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      {works.length > 0 && (
        <div className="border-t border-border bg-muted/30 px-4 py-3">
          <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-ink-muted">Recent works</div>
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
            {works.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => onWorkClick?.(w.id)}
                className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-surface-2 ring-1 ring-border hover:ring-primary transition"
                title={w.title}
              >
                {w.cover_url ? (
                  <img src={w.cover_url} alt={w.title} className="h-full w-full object-cover transition group-hover:scale-105" />
                ) : (
                  <div className="h-full w-full gradient-soft" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

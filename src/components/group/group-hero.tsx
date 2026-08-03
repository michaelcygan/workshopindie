import { Link, useRouter } from "@tanstack/react-router";
import { MapPin, Radio, Share2, Sparkles, Star, Users } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { JoinGroupButton } from "@/components/join-group-button";
import { Button } from "@/components/ui/button";

import { toast } from "sonner";
import { joinGroupLounge } from "@/lib/instant.functions";

export type GroupHeroData = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  kind: "city" | "genre" | "micro" | "scene";
  cover_url: string | null;
  avatar_url: string | null;
  member_count: number;
  is_official: boolean;
  featured_at: string | null;
  parent: { id: string; slug: string; name: string } | null;
};

export function GroupHero({
  group,
}: {
  group: GroupHeroData;
  /** @deprecated Next event now lives in the Today tab sidebar. */
  nextEvent?: { slug: string; title: string; starts_at: string } | null;
}) {
  const Icon = group.kind === "city" ? MapPin : Sparkles;

  const router = useRouter();
  const joinLoungeFn = useServerFn(joinGroupLounge);
  const openLounge = useMutation({
    mutationFn: () => joinLoungeFn({ data: { groupId: group.id } }),
    onSuccess: ({ roomId }) => {
      router.navigate({ to: "/lounge/$id", params: { id: roomId } });
    },
    onError: (e: Error) => toast.error(e.message ?? "Couldn't open the Lounge"),
  });

  // Ambient signal: how many people are in this Group's Lounge right now.
  const { data: liveCount = 0 } = useQuery({
    queryKey: ["group-lounge-live", group.id],
    refetchInterval: 45_000,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: rooms } = await supabase
        .from("instant_rooms")
        .select("id")
        .eq("group_id", group.id)
        .eq("status", "active")
        .limit(5);
      const ids = (rooms ?? []).map((r) => r.id as string);
      if (ids.length === 0) return 0;
      const since = new Date(Date.now() - 3 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("instant_presence")
        .select("user_id", { count: "exact", head: true })
        .in("room_id", ids)
        .gt("last_seen_at", since);
      return count ?? 0;
    },
  });


  const onShare = async () => {
    const url = typeof window !== "undefined" ? `${window.location.origin}/g/${group.slug}` : "";
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: group.name, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <>
      {/* Compact identity row — no banner. */}
      <div className="relative z-10 px-4 py-2 md:px-6 md:py-2.5">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 sm:gap-4">
          {/* Avatar tile */}
          <div className="relative isolate flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-surface ring-1 ring-border shadow-sm sm:h-14 sm:w-14">

            {group.avatar_url ? (
              <img
                src={group.avatar_url}
                alt={group.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="font-display text-2xl font-semibold leading-none text-ink-soft"
              >
                {group.name.trim().charAt(0).toUpperCase() || (
                  <Icon className="h-6 w-6 text-ink-muted" />
                )}
              </span>
            )}
          </div>

          {/* Title column — compact, one-row identity */}
          <div className="min-w-0">
            {group.parent && (
              <Link
                to="/g/$slug"
                params={{ slug: group.parent.slug }}
                className="mb-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-ink-muted hover:text-ink"
              >
                <span aria-hidden>←</span> in {group.parent.name}
              </Link>
            )}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="text-balance font-display text-xl leading-tight text-ink sm:text-2xl md:text-3xl">
                {group.name}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-soft">
                {group.kind}
              </span>
              {group.is_official && (
                <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-medium text-ink-soft">
                  Official
                </span>
              )}
              {group.featured_at && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  <Star className="h-3 w-3" /> Featured
                </span>
              )}
              {group.member_count > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted">
                  <Users className="h-3 w-3" />
                  {group.member_count}
                </span>
              )}
            </div>
            {group.tagline && (
              <p className="line-clamp-1 text-xs text-ink-muted md:text-sm">
                {group.tagline}
              </p>
            )}
          </div>

          {/* Right column: compact — Audio + Share + Join. Create lives in the tab bar. */}
          <div className="flex shrink-0 items-center gap-1.5">
            {live && !live.roomId ? (
              <Button
                size="sm"
                onClick={() => void live.joinAudio()}
                disabled={live.status === "joining" || !isMember}
                className="gap-1.5 rounded-full"
                title={
                  isMember
                    ? "Join this Group's live audio — no camera, mic stays off until you ask"
                    : "Join the Group to enter live audio"
                }
              >
                <Radio className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                  {live.status === "joining"
                    ? "Joining…"
                    : live.connectedCount > 0
                      ? `Join audio · ${live.connectedCount} live`
                      : "Join audio"}
                </span>
                {live.isLive ? (
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400"
                  />
                ) : null}
              </Button>
            ) : null}


            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={onShare}
              aria-label="Share group"
            >
              <Share2 className="h-4 w-4" />
            </Button>
            <JoinGroupButton
              groupId={group.id}
              parent={group.parent ? { id: group.parent.id, name: group.parent.name } : null}
            />
          </div>
        </div>
      </div>
    </>
  );
}

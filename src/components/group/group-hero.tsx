import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Radio, Share2, Sparkles, Users } from "lucide-react";
import { JoinGroupButton, useIsMemberOfGroup } from "@/components/join-group-button";
import { Button } from "@/components/ui/button";
import { useGroupLive } from "@/components/group/group-live-shell";
import { GroupPhotoEditor } from "@/components/group/group-photo-editor";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

import { toast } from "sonner";
import { workshopEntityUrl } from "@/lib/entities/kinds";

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

/**
 * Scene header. On mobile the Group's own photography leads — a restrained
 * band, not a full-screen hero — so a scanned NFC card lands somewhere that
 * feels like a place. Audio only appears when someone is actually connected;
 * an empty "Join audio" control is not chrome worth paying for.
 */
export function GroupHero({ group }: { group: GroupHeroData }) {
  const Icon = group.kind === "city" ? MapPin : Sparkles;

  const live = useGroupLive();
  const isMember = useIsMemberOfGroup(group.id).data === true;
  const audioLive = !!live && !live.roomId && live.connectedCount > 0;

  // Photo editing is admin-only. This is the convenience gate; `updateGroup`
  // enforces the role server-side.
  const { user } = useAuth();
  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
  });


  const onShare = async () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${workshopEntityUrl({ kind: "group", slug: group.slug })}`
        : "";
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
      {(group.cover_url || isAdmin) && (
        <div className="group/cover relative h-[168px] w-full overflow-hidden bg-surface-2 sm:h-[190px] md:h-[220px]">
          {group.cover_url ? (
            <img
              src={group.cover_url}
              alt=""
              width={1600}
              height={600}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-xs text-ink-muted">
              No banner photo yet
            </div>
          )}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-background to-transparent"
          />
          {isAdmin && (
            <div className="absolute right-3 top-3 z-20 opacity-100 transition-opacity md:opacity-0 md:group-hover/cover:opacity-100 md:focus-within:opacity-100">
              <GroupPhotoEditor groupId={group.id} target="cover" currentUrl={group.cover_url} />
            </div>
          )}
        </div>
      )}

      {/* Compact identity row. */}
      <div
        className={`relative z-10 px-4 py-2 md:px-6 md:py-2.5 ${
          group.cover_url || isAdmin ? "-mt-9 md:-mt-10" : ""
        }`}
      >
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 sm:gap-4">
          {/* Avatar tile */}
          <div className="group/avatar relative shrink-0">
            <div className="relative isolate flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-surface ring-1 ring-border shadow-sm sm:h-16 sm:w-16">
              {group.avatar_url ? (
                <img src={group.avatar_url} alt={group.name} className="h-full w-full object-cover" />
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
            {isAdmin && (
              <div className="absolute -bottom-1 -right-1 z-20 opacity-100 transition-opacity md:opacity-0 md:group-hover/avatar:opacity-100 md:focus-within:opacity-100">
                <GroupPhotoEditor
                  groupId={group.id}
                  target="avatar"
                  currentUrl={group.avatar_url}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface text-ink-soft shadow-sm transition-colors hover:text-ink"
                />
              </div>
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
            <div className="flex min-w-0 items-center gap-1.5">
              <h1 className="truncate text-balance font-display text-xl leading-tight text-ink sm:text-2xl md:text-3xl">
                {group.name}
              </h1>
              {group.is_official && (
                <span
                  title="Official Workshop Group"
                  aria-label="Official Workshop Group"
                  className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary/15 text-[9px] font-bold text-primary"
                >
                  ✓
                </span>
              )}
            </div>
            <div className="flex min-w-0 items-center gap-2 text-[11px] text-ink-muted md:text-xs">
              {group.member_count > 0 && (
                <span className="inline-flex shrink-0 items-center gap-1">
                  <Users className="h-3 w-3" />
                  {group.member_count}
                </span>
              )}
              {group.tagline && <span className="truncate">{group.tagline}</span>}
            </div>
          </div>

          {/* Right column: Share + Join. Audio surfaces only when live. */}
          <div className="flex shrink-0 items-center gap-1.5">
            {audioLive && (
              <Button
                size="sm"
                onClick={() => void live!.joinAudio()}
                disabled={live!.status === "joining" || !isMember}
                className="gap-1.5 rounded-full"
                title={
                  isMember
                    ? "Listen in — mic stays off until you ask"
                    : "Join the Group to enter live audio"
                }
              >
                <Radio className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                  {live!.status === "joining" ? "Joining…" : `Live · ${live!.connectedCount}`}
                </span>
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400"
                />
              </Button>
            )}

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

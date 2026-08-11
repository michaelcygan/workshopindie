import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowRight, Compass, Sparkles } from "lucide-react";
import type { GroupCardData } from "@/components/group-card";
import { GroupFeaturedCard } from "@/components/group-featured-card";
import { useGroupMemberAvatars } from "@/hooks/use-group-member-avatars";
import { GroupsActivityTicker } from "@/components/groups-activity-ticker";
import { GroupsNewMembersRail } from "@/components/groups-new-members-rail";
import { GroupsPeopleRail } from "@/components/groups-people-rail";
import {
  GroupsDirectory,
  useAllPublicGroups,
  type DirectoryState,
} from "@/components/groups/groups-directory";

type Props = {
  state: DirectoryState;
  onChange: (patch: Partial<DirectoryState>) => void;
  onReset: () => void;
  myIds: Set<string>;
};

/**
 * The signed-in Groups front page: your scenes first, then what's moving
 * across Workshop, then the full directory.
 */
export function MemberGroupsHome({ state, onChange, onReset, myIds }: Props) {
  const { data: allGroups = [], isLoading } = useAllPublicGroups();

  const mine = useMemo(
    () =>
      allGroups
        .filter((g) => myIds.has(g.id))
        .sort((a, b) => scoreActivity(b) - scoreActivity(a)),
    [allGroups, myIds],
  );


  const featured = useMemo(
    () => allGroups.filter((g) => !!g.featured_at && !myIds.has(g.id)).slice(0, 3),
    [allGroups, myIds],
  );

  const avatarIds = useMemo(
    () => [...mine, ...featured].map((g) => g.id),
    [mine, featured],
  );
  const { data: avatarMap } = useGroupMemberAvatars(avatarIds);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 border-b border-border pb-6 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Communities
          </p>
          <h1 className="mt-1 font-display text-[30px] leading-tight text-ink md:text-[44px]">
            Your scenes
          </h1>
          <p className="mt-2 max-w-xl text-sm text-ink-muted md:text-base">
            The cities, mediums, and movements your work belongs with.
          </p>
        </div>
        <Link
          to="/groups"
          search={{ t: "all", q: "", c: "all", s: "members" }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-ink transition hover:bg-muted"
        >
          <Compass className="h-4 w-4" /> Explore
        </Link>
      </header>

      {/* Your groups */}
      <section className="mt-8">
        {isLoading ? (
          <div className="grid gap-5 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-48 animate-pulse rounded-2xl bg-surface-2" />
            ))}
          </div>
        ) : mine.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center md:p-10">
            <h2 className="font-display text-xl text-ink md:text-2xl">
              You haven't joined a Group yet.
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
              Groups are how your Work, Collabs, and Events find an audience. Start with your
              city or your medium.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-lg text-ink md:text-xl">Where you belong</h2>
              <span className="text-xs text-ink-muted">
                {myIds.size} {myIds.size === 1 ? "group" : "groups"} joined
              </span>
            </div>
            <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:snap-none md:grid-cols-3 md:overflow-visible md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {mine.map((g) => (
                <div key={g.id} className="w-[85vw] shrink-0 snap-start sm:w-[70vw] md:w-auto">
                  <GroupFeaturedCard group={g} joined avatars={avatarMap?.get(g.id)} />
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* What's moving */}
      <GroupsActivityTicker />
      <GroupsNewMembersRail />
      <GroupsPeopleRail />

      {/* Handpicked scenes you're not in yet */}
      {featured.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="inline-flex items-center gap-2 font-display text-lg text-ink md:text-xl">
              <Sparkles className="h-4 w-4 text-primary" /> Worth joining
            </h2>
            <Link
              to="/groups"
              search={{ t: "all", q: "", c: "all", s: "featured" }}
              className="inline-flex items-center gap-1 text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
            >
              See all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {featured.map((g) => (
              <GroupFeaturedCard key={g.id} group={g} joined={false} avatars={avatarMap?.get(g.id)} />
            ))}
          </div>
        </section>
      )}

      <div className="mt-12">
        <GroupsDirectory
          state={state}
          onChange={onChange}
          onReset={onReset}
          authenticated
          myIds={myIds}
          eyebrow="Directory"
          heading="Every Group on Workshop"
        />
      </div>
    </main>
  );
}

function scoreActivity(g: GroupCardData) {
  return g.work_count + g.collab_count + g.workshop_count + Math.min(g.member_count, 200) / 100;
}

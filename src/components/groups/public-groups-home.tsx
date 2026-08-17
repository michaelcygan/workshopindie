import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { MapPin } from "lucide-react";
import { GroupFeaturedCard } from "@/components/group-featured-card";
import { GroupCompactCard } from "@/components/groups/group-compact-card";
import { useGroupMemberAvatars } from "@/hooks/use-group-member-avatars";
import { GroupsActivityTicker } from "@/components/groups-activity-ticker";
import { GroupsPeopleRail } from "@/components/groups-people-rail";
import {
  GroupsDirectory,
  useAllPublicGroups,
  type DirectoryState,
} from "@/components/groups/groups-directory";
import {
  GroupsControlRow,
  isDirectoryFiltered,
} from "@/components/groups/groups-control-row";
import { categoryLabel } from "@/lib/taxonomy";

type Props = {
  state: DirectoryState;
  onChange: (patch: Partial<DirectoryState>) => void;
  onReset: () => void;
};

/**
 * The logged-out Groups front page: an editorial view of Workshop's creative
 * communities — a lead scene, a swipeable featured rail, the cities they run
 * in, and the full directory. Mobile rhythm mirrors /blog and /events.
 */
export function PublicGroupsHome({ state, onChange, onReset }: Props) {
  const { data: allGroups = [], isLoading } = useAllPublicGroups();

  const featured = useMemo(() => {
    const picked = allGroups.filter((g) => !!g.featured_at);
    const rest = allGroups
      .filter((g) => !g.featured_at)
      .sort((a, b) => b.member_count - a.member_count);
    return [...picked, ...rest].slice(0, 7);
  }, [allGroups]);

  const lead = featured[0];
  const restFeatured = featured.slice(1);

  const cities = useMemo(
    () =>
      allGroups
        .filter((g) => g.kind === "city")
        .sort((a, b) => b.member_count - a.member_count),
    [allGroups],
  );

  const mediums = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of allGroups) {
      if (g.kind !== "genre" || !g.category) continue;
      counts.set(g.category, (counts.get(g.category) ?? 0) + 1);
    }
    return Array.from(counts.keys()).slice(0, 12);
  }, [allGroups]);

  const { data: avatarMap } = useGroupMemberAvatars(
    useMemo(() => featured.map((g) => g.id), [featured]),
  );

  const empty = new Set<string>();
  const filtered = isDirectoryFiltered(state);

  return (
    <main className="pb-24 md:pb-16">
      {/* Compact editorial masthead — same proportions as /blog */}
      <header className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-4 md:px-6 md:py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Workshop Groups
          </p>
          <h1 className="mt-1.5 max-w-3xl font-display text-[28px] leading-[1.06] tracking-tight text-ink md:text-[48px]">
            Independent scenes, city by city.
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-soft md:text-[15px]">
            Open mics, screenings, film crews, record labels, writing rooms. Find the one your
            work belongs with.
          </p>

          {allGroups.length > 0 && (
            <div className="mt-2.5">
              <span className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] font-medium text-ink-soft">
                {allGroups.length.toLocaleString()} scenes
                {cities.length > 0 && ` · ${cities.length} cities`}
              </span>
            </div>
          )}
        </div>
      </header>

      <GroupsControlRow state={state} onChange={onChange} onReset={onReset} />

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        {filtered ? null : (
        <>
        {/* Lead scene */}
        <section>
          <h2 className="mb-3 font-display text-lg text-ink md:text-2xl">Scenes to know</h2>
          {isLoading ? (
            <div className="h-56 animate-pulse rounded-xl bg-surface-2 md:h-72" />
          ) : (
            lead && (
              <div className="md:grid md:grid-cols-3 md:gap-5">
                <div className="md:col-span-2">
                  <GroupFeaturedCard group={lead} joined={false} avatars={avatarMap?.get(lead.id)} />
                </div>
                <div className="mt-4 hidden gap-5 md:col-span-1 md:mt-0 md:grid md:content-start">
                  {restFeatured.slice(0, 2).map((g) => (
                    <GroupCompactCard key={g.id} group={g} joined={false} />
                  ))}
                </div>
              </div>
            )
          )}
        </section>

        {/* Live activity, high on the page */}
        <GroupsActivityTicker />

        {/* Featured rail — swipeable on mobile, grid on desktop */}
        {restFeatured.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 font-display text-lg text-ink md:text-2xl">More to explore</h2>
            <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:px-0">
              {restFeatured.map((g) => (
                <GroupCompactCard
                  key={g.id}
                  group={g}
                  joined={false}
                  className="w-[240px] shrink-0 snap-start md:w-auto"
                />
              ))}
            </div>
          </section>
        )}

        {/* Cities */}
        {cities.length > 0 && (
          <section className="mt-9 border-t border-border pt-7">
            <h2 className="inline-flex items-center gap-2 font-display text-lg text-ink md:text-2xl">
              <MapPin className="h-4 w-4 text-primary" /> Cities on Workshop
            </h2>
            <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:px-0">
              {cities.slice(0, 18).map((g) => (
                <Link
                  key={g.id}
                  to="/g/$slug"
                  params={{ slug: g.slug }}
                  className="shrink-0 whitespace-nowrap rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm text-ink transition hover:bg-muted"
                >
                  {g.name}
                  {g.member_count > 0 && (
                    <span className="ml-1.5 text-xs text-ink-muted">
                      {g.member_count.toLocaleString()}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Mediums */}
        {mediums.length > 0 && (
          <section className="mt-7">
            <h2 className="font-display text-lg text-ink md:text-2xl">By medium</h2>
            <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:px-0">
              {mediums.map((c) => (
                <Link
                  key={c}
                  to="/groups"
                  search={{ t: "genre", q: "", c, s: "members" }}
                  className="shrink-0 whitespace-nowrap rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm text-ink transition hover:bg-muted"
                >
                  {categoryLabel(c)}
                </Link>
              ))}
            </div>
          </section>
        )}

        <GroupsPeopleRail />

        {/* Join CTA — inline, sized like the blog promos */}
        <section className="mt-9 flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
          <div className="min-w-0">
            <h2 className="font-display text-lg text-ink md:text-xl">Make something with them.</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Post work, open a collab, and show up at the events your scene runs.
            </p>
          </div>
          <Link
            to="/signup"
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-background transition hover:bg-ink/90"
          >
            Create your account
          </Link>
        </section>
        </>
        )}

        <div className={filtered ? "" : "mt-10 border-t border-border pt-8"}>
          <GroupsDirectory
            state={state}
            onChange={onChange}
            onReset={onReset}
            authenticated={false}
            myIds={empty}
          />
        </div>
      </div>
    </main>
  );
}

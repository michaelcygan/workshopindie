import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowRight, MapPin } from "lucide-react";
import { GroupFeaturedCard } from "@/components/group-featured-card";
import { useGroupMemberAvatars } from "@/hooks/use-group-member-avatars";
import { GroupsActivityTicker } from "@/components/groups-activity-ticker";
import { GroupsPeopleRail } from "@/components/groups-people-rail";
import {
  GroupsDirectory,
  useAllPublicGroups,
  type DirectoryState,
} from "@/components/groups/groups-directory";
import { categoryLabel } from "@/lib/taxonomy";

type Props = {
  state: DirectoryState;
  onChange: (patch: Partial<DirectoryState>) => void;
  onReset: () => void;
};

/**
 * The logged-out Groups front page: an editorial view of Workshop's creative
 * communities — featured scenes, the cities they run in, and the directory.
 */
export function PublicGroupsHome({ state, onChange, onReset }: Props) {
  const { data: allGroups = [], isLoading } = useAllPublicGroups();

  const featured = useMemo(() => {
    const picked = allGroups.filter((g) => !!g.featured_at);
    const rest = allGroups
      .filter((g) => !g.featured_at)
      .sort((a, b) => b.member_count - a.member_count);
    return [...picked, ...rest].slice(0, 6);
  }, [allGroups]);

  const cities = useMemo(
    () =>
      allGroups
        .filter((g) => g.kind === "city")
        .sort((a, b) => b.member_count - a.member_count)
        .slice(0, 14),
    [allGroups],
  );

  const mediums = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of allGroups) {
      if (g.kind !== "genre" || !g.category) continue;
      counts.set(g.category, (counts.get(g.category) ?? 0) + 1);
    }
    return Array.from(counts.keys()).slice(0, 10);
  }, [allGroups]);

  const { data: avatarMap } = useGroupMemberAvatars(
    useMemo(() => featured.map((g) => g.id), [featured]),
  );

  const empty = new Set<string>();

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
      {/* Editorial hero */}
      <header className="border-b border-border pb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          Workshop Groups
        </p>
        <h1 className="mt-2 max-w-3xl font-display text-[34px] leading-[1.05] text-ink md:text-[60px]">
          Independent scenes, city by city.
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-ink-muted md:text-base">
          Groups are where Workshop's culture actually happens — open mics, screenings, film
          crews, record labels, writing rooms. Find the one your work belongs with.
        </p>
      </header>

      {/* Featured scenes */}
      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg text-ink md:text-2xl">Scenes to know</h2>
          <Link
            to="/groups"
            search={{ t: "all", q: "", c: "all", s: "members" }}
            className="inline-flex items-center gap-1 text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
          >
            Browse all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {isLoading ? (
          <div className="grid gap-5 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-48 animate-pulse rounded-2xl bg-surface-2" />
            ))}
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((g) => (
              <GroupFeaturedCard key={g.id} group={g} joined={false} avatars={avatarMap?.get(g.id)} />
            ))}
          </div>
        )}
      </section>

      {/* Live activity */}
      <GroupsActivityTicker />

      {/* Cities */}
      {cities.length > 0 && (
        <section className="mt-10 border-t border-border pt-8">
          <h2 className="inline-flex items-center gap-2 font-display text-lg text-ink md:text-2xl">
            <MapPin className="h-4 w-4 text-primary" /> Cities on Workshop
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {cities.map((g) => (
              <Link
                key={g.id}
                to="/g/$slug"
                params={{ slug: g.slug }}
                className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm text-ink transition hover:bg-muted"
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
        <section className="mt-8">
          <h2 className="font-display text-lg text-ink md:text-2xl">By medium</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {mediums.map((c) => (
              <Link
                key={c}
                to="/groups"
                search={{ t: "genre", q: "", c, s: "members" }}
                className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm text-ink transition hover:bg-muted"
              >
                {categoryLabel(c)}
              </Link>
            ))}
          </div>
        </section>
      )}

      <GroupsPeopleRail />

      {/* Join CTA */}
      <section className="mt-10 rounded-2xl border border-border bg-surface p-8 text-center md:p-10">
        <h2 className="font-display text-xl text-ink md:text-3xl">Make something with them.</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
          Join Workshop to post work, open a collab, and show up at the events your scene runs.
        </p>
        <Link
          to="/signup"
          className="mt-5 inline-flex items-center rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-background transition hover:bg-ink/90"
        >
          Create your account
        </Link>
      </section>

      <div className="mt-12">
        <GroupsDirectory
          state={state}
          onChange={onChange}
          onReset={onReset}
          authenticated={false}
          myIds={empty}
          eyebrow="Directory"
          heading="Every Group on Workshop"
        />
      </div>
    </main>
  );
}

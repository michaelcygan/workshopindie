import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { RecapChip } from "@/components/recap-chip";

type Person = {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  headline: string | null;
  sharedGroup: { slug: string; name: string; accent: string | null };
  overlap: number;
};

async function fetchSuggestedPeople(userId: string): Promise<Person[]> {
  // Viewer's group ids
  const { data: mine } = await supabase
    .from("group_members")
    .select("group_id,group:groups!inner(slug,name,accent_color,visibility,deleted_at)")
    .eq("user_id", userId);
  const myGroups = (mine ?? [])
    .filter((r) => {
      const g = r.group as unknown as { visibility: string; deleted_at: string | null };
      return g && g.visibility === "public" && !g.deleted_at;
    });
  const myGroupIds = myGroups.map((r) => r.group_id as string);
  if (myGroupIds.length === 0) return [];

  // Members of viewer's groups
  const { data: others } = await supabase
    .from("group_members")
    .select("user_id,group_id")
    .in("group_id", myGroupIds)
    .neq("user_id", userId)
    .limit(1000);

  // Rank by overlap count (how many of viewer's groups they share)
  const overlap = new Map<string, { count: number; groupId: string }>();
  for (const row of others ?? []) {
    const uid = row.user_id as string;
    const existing = overlap.get(uid);
    if (existing) existing.count += 1;
    else overlap.set(uid, { count: 1, groupId: row.group_id as string });
  }
  if (overlap.size === 0) return [];

  // Exclude already-followed
  const candidateIds = [...overlap.keys()];
  const { data: existingFollows } = await supabase
    .from("follows")
    .select("followee_id")
    .eq("follower_id", userId)
    .in("followee_id", candidateIds);
  const followedSet = new Set((existingFollows ?? []).map((r) => r.followee_id as string));

  const ranked = candidateIds
    .filter((id) => !followedSet.has(id))
    .sort((a, b) => (overlap.get(b)!.count - overlap.get(a)!.count))
    .slice(0, 12);

  if (ranked.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,username,display_name,avatar_url,headline")
    .in("id", ranked);

  const groupById = new Map(
    myGroups.map((r) => {
      const g = r.group as unknown as { slug: string; name: string; accent_color: string | null };
      return [r.group_id as string, { slug: g.slug, name: g.name, accent: g.accent_color }];
    }),
  );

  return (profiles ?? [])
    .map((p) => {
      const meta = overlap.get(p.id as string);
      const sharedId = meta?.groupId;
      const shared = sharedId ? groupById.get(sharedId) : undefined;
      if (!shared) return null;
      return {
        id: p.id as string,
        username: (p.username as string | null) ?? null,
        displayName: (p.display_name as string | null) ?? null,
        avatarUrl: (p.avatar_url as string | null) ?? null,
        headline: (p.headline as string | null) ?? null,
        sharedGroup: shared,
        overlap: meta?.count ?? 1,
      } as Person;
    })
    .filter(Boolean)
    .slice(0, 8) as Person[];
}

export function GroupsPeopleRail() {
  const { user } = useAuth();
  const { data = [], isLoading } = useQuery({
    queryKey: ["groups-suggested-people", user?.id ?? "anon"],
    enabled: !!user,
    queryFn: () => fetchSuggestedPeople(user!.id),
    staleTime: 5 * 60_000,
  });

  if (!user || isLoading || data.length === 0) return null;

  return (
    <section className="mt-8" aria-label="People from your groups">
      <div className="mb-3 flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-xl text-ink md:text-2xl">People from your Groups</h2>
          <RecapChip count={data.length} label="to follow" />
        </div>
        <span className="text-xs text-ink-muted">Members you don't follow yet</span>
      </div>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:snap-none md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {data.map((p) => {
          const name = p.displayName ?? p.username ?? "Member";
          return (
            <Link
              key={p.id}
              to="/u/$username"
              params={{ username: p.username ?? p.id }}
              className="group flex w-[75vw] shrink-0 snap-start items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift sm:w-[55vw] md:w-auto"
            >
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
                {p.avatarUrl ? (
                  <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-sm font-semibold text-ink-muted">
                    {name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-sm text-ink group-hover:underline">
                  {name}
                </div>
                {p.headline ? (
                  <div className="truncate text-[11px] text-ink-muted">{p.headline}</div>
                ) : null}
                <div className="mt-1 flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: p.sharedGroup.accent ?? "var(--ink)" }}
                  />
                  <span className="truncate text-[11px] text-ink-muted">
                    via {p.sharedGroup.name}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

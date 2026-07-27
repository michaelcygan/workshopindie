import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { RecapChip } from "@/components/recap-chip";

type Row = {
  groupId: string;
  slug: string;
  name: string;
  accent: string | null;
  avatarUrl: string | null;
  count: number;
  joiners: { id: string; avatar: string | null; name: string }[];
};

async function fetchNewMembers(): Promise<Row[]> {
  const sinceIso = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString();

  const { data: joins } = await supabase
    .from("group_members")
    .select(
      "user_id,group_id,joined_at,group:groups!inner(id,slug,name,accent_color,avatar_url,visibility,deleted_at)",
    )
    .gte("joined_at", sinceIso)
    .order("joined_at", { ascending: false })
    .limit(400);

  const grouped = new Map<string, Row>();
  const userIds = new Set<string>();
  for (const row of (joins ?? []) as unknown as Array<{
    user_id: string;
    group_id: string;
    joined_at: string;
    group: { id: string; slug: string; name: string; accent_color: string | null; avatar_url: string | null; visibility: string; deleted_at: string | null };
  }>) {
    if (!row.group || row.group.visibility !== "public" || row.group.deleted_at) continue;
    userIds.add(row.user_id);
    const existing = grouped.get(row.group_id);
    if (existing) {
      existing.count += 1;
      if (existing.joiners.length < 5) existing.joiners.push({ id: row.user_id, avatar: null, name: "" });
    } else {
      grouped.set(row.group_id, {
        groupId: row.group_id,
        slug: row.group.slug,
        name: row.group.name,
        accent: row.group.accent_color,
        avatarUrl: row.group.avatar_url,
        count: 1,
        joiners: [{ id: row.user_id, avatar: null, name: "" }],
      });
    }
  }

  const top = [...grouped.values()].sort((a, b) => b.count - a.count).slice(0, 8);

  if (top.length === 0) return [];

  const ids = new Set<string>();
  for (const r of top) for (const j of r.joiners) ids.add(j.id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,avatar_url,display_name,username")
    .in("id", [...ids]);
  const byId = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      {
        avatar: (p.avatar_url as string | null) ?? null,
        name: ((p.display_name as string | null) ?? (p.username as string | null) ?? "") as string,
      },
    ]),
  );
  for (const r of top) {
    r.joiners = r.joiners.map((j) => ({ ...j, ...(byId.get(j.id) ?? {}) }));
  }
  return top;
}

export function GroupsNewMembersRail() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["groups-new-members-week"],
    queryFn: fetchNewMembers,
    staleTime: 5 * 60_000,
  });

  if (isLoading || data.length === 0) return null;

  return (
    <section className="mt-8" aria-label="Groups gaining members this week">
      <div className="mb-3 flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-xl text-ink md:text-2xl">Momentum this week</h2>
          <RecapChip count={data.length} label="growing" />
        </div>
        <span className="text-xs text-ink-muted">New members in the last 7 days</span>
      </div>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:snap-none md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {data.map((row) => (
          <Link
            key={row.groupId}
            to="/g/$slug"
            params={{ slug: row.slug }}
            className="group flex w-[75vw] shrink-0 snap-start items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift sm:w-[55vw] md:w-auto"
          >
            <div
              className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl"
              style={{ backgroundColor: row.accent ?? "var(--muted)" }}
            >
              {row.avatarUrl ? (
                <img src={row.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-sm text-ink group-hover:underline">
                {row.name}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="flex -space-x-2">
                  {row.joiners.slice(0, 4).map((j) =>
                    j.avatar ? (
                      <img
                        key={j.id}
                        src={j.avatar}
                        alt=""
                        className="h-5 w-5 rounded-full border-2 border-surface object-cover"
                      />
                    ) : (
                      <div
                        key={j.id}
                        className="h-5 w-5 rounded-full border-2 border-surface bg-muted"
                      />
                    ),
                  )}
                </div>
                <span className="text-[11px] text-ink-muted">
                  +{row.count} {row.count === 1 ? "new member" : "new members"}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

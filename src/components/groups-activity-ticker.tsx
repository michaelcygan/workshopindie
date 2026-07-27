import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarDays, MessageSquare, Sparkles, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type ActivityItem = {
  id: string;
  kind: "group" | "event" | "today" | "member";
  groupSlug: string;
  groupName: string;
  accent: string | null;
  title: string;
  at: string;
};

/** Aggregates recent activity across public groups into a marquee ticker. */
async function fetchGroupsActivity(): Promise<ActivityItem[]> {
  const sinceIso = new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString();

  const [newGroups, newEvents, newToday, newMembers] = await Promise.all([
    supabase
      .from("groups")
      .select("id,slug,name,accent_color,created_at")
      .is("deleted_at", null)
      .eq("visibility", "public")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("group_events")
      .select(
        "id,title,created_at,group:groups!group_events_group_id_fkey!inner(slug,name,accent_color,visibility,deleted_at)",
      )
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("group_today_posts")
      .select(
        "id,body,created_at,group:groups!inner(slug,name,accent_color,visibility,deleted_at)",
      )
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("group_members")
      .select(
        "group_id,created_at,group:groups!inner(slug,name,accent_color,visibility,deleted_at)",
      )
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const items: ActivityItem[] = [];

  for (const g of newGroups.data ?? []) {
    items.push({
      id: `g-${g.id}`,
      kind: "group",
      groupSlug: g.slug as string,
      groupName: g.name as string,
      accent: (g.accent_color as string | null) ?? null,
      title: "New Group opened",
      at: g.created_at as string,
    });
  }
  for (const row of (newEvents.data ?? []) as Array<{
    id: string;
    title: string;
    created_at: string;
    group: { slug: string; name: string; accent_color: string | null; visibility: string; deleted_at: string | null };
  }>) {
    if (!row.group || row.group.visibility !== "public" || row.group.deleted_at) continue;
    items.push({
      id: `e-${row.id}`,
      kind: "event",
      groupSlug: row.group.slug,
      groupName: row.group.name,
      accent: row.group.accent_color,
      title: row.title,
      at: row.created_at,
    });
  }
  for (const row of (newToday.data ?? []) as Array<{
    id: string;
    body: string;
    created_at: string;
    group: { slug: string; name: string; accent_color: string | null; visibility: string; deleted_at: string | null };
  }>) {
    if (!row.group || row.group.visibility !== "public" || row.group.deleted_at) continue;
    const snippet = (row.body ?? "").replace(/\s+/g, " ").trim();
    if (!snippet) continue;
    items.push({
      id: `t-${row.id}`,
      kind: "today",
      groupSlug: row.group.slug,
      groupName: row.group.name,
      accent: row.group.accent_color,
      title: snippet.length > 64 ? snippet.slice(0, 64) + "…" : snippet,
      at: row.created_at,
    });
  }
  // Roll up members by group so we don't spam.
  const memberCounts = new Map<string, { count: number; row: { slug: string; name: string; accent_color: string | null }; at: string }>();
  for (const row of (newMembers.data ?? []) as Array<{
    group_id: string;
    created_at: string;
    group: { slug: string; name: string; accent_color: string | null; visibility: string; deleted_at: string | null };
  }>) {
    if (!row.group || row.group.visibility !== "public" || row.group.deleted_at) continue;
    const existing = memberCounts.get(row.group_id);
    if (existing) existing.count += 1;
    else
      memberCounts.set(row.group_id, {
        count: 1,
        row: { slug: row.group.slug, name: row.group.name, accent_color: row.group.accent_color },
        at: row.created_at,
      });
  }
  for (const [gid, entry] of memberCounts) {
    if (entry.count < 2) continue;
    items.push({
      id: `m-${gid}`,
      kind: "member",
      groupSlug: entry.row.slug,
      groupName: entry.row.name,
      accent: entry.row.accent_color,
      title: `${entry.count} new members`,
      at: entry.at,
    });
  }

  return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 24);
}

function KindIcon({ kind }: { kind: ActivityItem["kind"] }) {
  const Cmp =
    kind === "event"
      ? CalendarDays
      : kind === "today"
        ? MessageSquare
        : kind === "member"
          ? Users
          : Sparkles;
  return <Cmp className="h-3 w-3" aria-hidden />;
}

function kindLabel(kind: ActivityItem["kind"]): string {
  switch (kind) {
    case "event":
      return "Event";
    case "today":
      return "Today";
    case "member":
      return "Joins";
    case "group":
    default:
      return "New";
  }
}

export function GroupsActivityTicker() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["groups-activity-ticker"],
    queryFn: fetchGroupsActivity,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  if (isLoading || data.length === 0) return null;

  const minItems = 20;
  let copies = Math.max(2, Math.ceil(minItems / data.length));
  if (copies % 2 !== 0) copies += 1;
  const loop = Array.from({ length: copies }).flatMap(() => data);

  return (
    <section aria-label="Live across Groups" className="mt-6">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-hidden />
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-ink-muted">
            Live across Groups
          </h2>
        </div>
        <span className="text-[11px] text-ink-muted/70">last 14 days</span>
      </div>
      <div
        className="group relative overflow-hidden rounded-2xl border border-border bg-surface shadow-soft"
        style={{
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0, black 4%, black 96%, transparent 100%)",
          maskImage:
            "linear-gradient(to right, transparent 0, black 4%, black 96%, transparent 100%)",
        }}
      >
        <div
          className="flex w-max items-center gap-3 whitespace-nowrap py-2.5 pl-4 group-hover:[animation-play-state:paused] motion-reduce:animation-none"
          style={{ animation: "groups-activity-ticker 120s linear infinite" }}
        >
          {loop.map((item, i) => (
            <Link
              key={`${item.id}-${i}`}
              to="/g/$slug"
              params={{ slug: item.groupSlug }}
              className="inline-flex h-8 shrink-0 items-center gap-2 rounded-full border border-border bg-background px-3 text-[12px] leading-none transition hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-soft"
            >
              <span
                aria-hidden
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-background"
                style={{ backgroundColor: item.accent ?? "var(--ink)" }}
              >
                <KindIcon kind={item.kind} />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                {kindLabel(item.kind)}
              </span>
              <span className="font-display text-[12px] text-ink">{item.title}</span>
              <span className="text-[11px] text-ink-muted">· {item.groupName}</span>
            </Link>
          ))}
        </div>
        <style>{`
          @keyframes groups-activity-ticker {
            from { transform: translate3d(0, 0, 0); }
            to   { transform: translate3d(-50%, 0, 0); }
          }
        `}</style>
      </div>
    </section>
  );
}

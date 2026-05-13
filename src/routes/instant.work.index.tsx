import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Hammer, Plus, Users, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { CATEGORIES, type Category, categoryClass } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { formatDistanceToNowStrict } from "date-fns";

export const Route = createFileRoute("/instant/work/")({
  component: WorkBrowser,
  head: () => ({
    meta: [
      { title: "Work — Instant" },
      { name: "description", content: "Live task-based lobbies. Make something with someone, right now." },
    ],
  }),
});

type WorkRoom = {
  id: string;
  title: string;
  prompt: string | null;
  medium: Category | null;
  ends_at: string | null;
  creator_id: string | null;
  participant_cap: number;
  presence_count?: number;
  creator?: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
};

function WorkBrowser() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [filter, setFilter] = useState<Category | "all">("all");

  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/login" });
  }, [user, loading, router]);

  const { data: rooms, isLoading } = useQuery({
    queryKey: ["instant-work-rooms"],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("instant_rooms")
        .select("id,title,prompt,medium,ends_at,creator_id,participant_cap")
        .eq("kind", "work")
        .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
        .order("ends_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      const list = data ?? [];
      const ids = list.map((r) => r.id);
      const creatorIds = Array.from(new Set(list.map((r) => r.creator_id).filter((x): x is string => !!x)));
      const counts: Record<string, number> = {};
      const creators: Record<string, WorkRoom["creator"]> = {};
      if (ids.length > 0) {
        const { data: pres } = await supabase.from("instant_presence").select("room_id").in("room_id", ids);
        for (const p of pres ?? []) counts[p.room_id] = (counts[p.room_id] ?? 0) + 1;
      }
      if (creatorIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles").select("id,display_name,username,avatar_url").in("id", creatorIds);
        for (const p of profs ?? []) creators[p.id] = { display_name: p.display_name, username: p.username, avatar_url: p.avatar_url };
      }
      return list.map((r) => ({
        ...r,
        presence_count: counts[r.id] ?? 0,
        creator: r.creator_id ? creators[r.creator_id] ?? null : null,
      })) as WorkRoom[];
    },
    refetchInterval: 20_000,
  });

  const filtered = (rooms ?? []).filter((r) => filter === "all" || r.medium === filter);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-10">
      <Link to="/instant" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Instant
      </Link>
      <div className="mt-3 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl md:text-4xl text-ink flex items-center gap-2">
            <Hammer className="h-6 w-6" /> Work
          </h1>
          <p className="mt-1 text-sm text-ink-muted">Live task lobbies. Bring a prompt, ship together.</p>
        </div>
        <Link to="/instant/work/new">
          <Button className="rounded-full gap-2"><Plus className="h-4 w-4" /> Spawn lobby</Button>
        </Link>
      </div>

      {/* Medium filter */}
      <div className="mt-6 flex flex-wrap gap-1 rounded-full border border-border bg-surface p-1 shadow-soft w-fit">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>All</FilterChip>
        {CATEGORIES.map((c) => (
          <FilterChip key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)}>{c.label}</FilterChip>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-2" />
          ))
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-surface p-10 text-center">
            <h3 className="font-display text-xl text-ink">No live lobbies{filter !== "all" ? ` in ${filter}` : ""}.</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">Be the one. Spawn a lobby, drop a prompt, see who joins.</p>
            <Link to="/instant/work/new" className="mt-4 inline-block">
              <Button className="rounded-full gap-2"><Plus className="h-4 w-4" /> Spawn a lobby</Button>
            </Link>
          </div>
        ) : (
          filtered.map((r) => <WorkRow key={r.id} room={r} />)
        )}
      </div>
    </main>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-sm transition",
        active ? "bg-ink text-background" : "text-ink-soft hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function WorkRow({ room }: { room: WorkRoom }) {
  const ends = room.ends_at ? new Date(room.ends_at) : null;
  const endsLabel = ends ? `ends in ${formatDistanceToNowStrict(ends)}` : "open-ended";
  const creatorName = room.creator?.display_name || room.creator?.username || "Someone";

  return (
    <Link
      to="/instant/work/$id"
      params={{ id: room.id }}
      className="block rounded-2xl border border-border bg-surface p-4 md:p-5 transition hover:shadow-lift"
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {room.medium && (
              <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide", categoryClass(room.medium))}>
                {room.medium}
              </span>
            )}
            <span className="text-xs text-ink-muted inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {endsLabel}
            </span>
          </div>
          <p className="mt-2 font-display text-lg text-ink leading-snug line-clamp-2">{room.prompt || room.title}</p>
          <p className="mt-1.5 text-xs text-ink-muted">by {creatorName}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-ink-soft">
            <Users className="h-3 w-3" /> {room.presence_count}/{room.participant_cap}
          </div>
        </div>
      </div>
    </Link>
  );
}

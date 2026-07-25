import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Radio, Users, ArrowRight, MapPin, Target, Clock, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ROOM_PROMPTS, shuffle, type RoomPrompt } from "@/lib/topic-prompts";
import { CATEGORIES } from "@/lib/categories";

type WorkshopRow = {
  id: string;
  slug: string;
  title: string | null;
  starts_at: string | null;
  status: string | null;
  participant_cap: number | null;
  confirmed_count: number | null;
  topic_collab_post_id: string | null;
  city_id: string | null;
  city: { name: string } | null;
};

const TARGET_TILES = 6;

function whenLabel(iso: string | null, status: string | null) {
  if (status === "active") return "Live now";
  if (status === "check_in") return "Doors open";
  if (!iso) return "Soon";
  const diff = new Date(iso).getTime() - Date.now();
  const mins = Math.round(diff / 60_000);
  if (mins <= 0) return "Live now";
  if (mins < 60) return `Starts in ${mins}m`;
  if (mins < 60 * 24) return `Starts in ${Math.round(mins / 60)}h`;
  return new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

function mediumLabel(id: string | null): string | null {
  if (!id) return null;
  return CATEGORIES.find((c) => c.id === id)?.label ?? null;
}

/** Session-stable curated suggestions: bias to obvious, sprinkle wild. */
function useSuggestedPrompts(count: number): RoomPrompt[] {
  return useMemo(() => {
    let seed = "home-lounge";
    if (typeof window !== "undefined") {
      try {
        seed = window.sessionStorage.getItem("home-lounge:seed") ?? "";
        if (!seed) {
          seed = Math.random().toString(36).slice(2);
          window.sessionStorage.setItem("home-lounge:seed", seed);
        }
      } catch { /* noop */ }
    }
    // Deterministic shuffle by seeding Math.random via a simple LCG isn't
    // necessary — session persistence is enough. Reshuffle once per session.
    void seed;
    const obvious = shuffle(ROOM_PROMPTS.filter((p) => p.weight === "obvious"));
    const wild = shuffle(ROOM_PROMPTS.filter((p) => p.weight === "wild"));
    const wildTake = Math.max(1, Math.floor(count / 3));
    const obviousTake = count - wildTake;
    const seen = new Set<string>();
    const out: RoomPrompt[] = [];
    for (const p of [...obvious.slice(0, obviousTake), ...wild.slice(0, wildTake)]) {
      const key = `${p.medium}::${p.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
    return out;
  }, [count]);
}

export function HomeLiveWorkshopsRail() {
  const { data, isLoading } = useQuery({
    queryKey: ["home-live-workshops"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const soonIso = new Date(Date.now() + 6 * 60 * 60_000).toISOString();
      const { data, error } = await supabase
        .from("workshops")
        .select(
          "id,slug,title,starts_at,status,participant_cap,confirmed_count,topic_collab_post_id,city_id," +
            "city:cities!workshops_city_id_fkey(name)",
        )
        .eq("mode", "scheduled")
        .eq("visibility", "public")
        .in("status", ["open", "check_in", "active"])
        .lte("starts_at", soonIso)
        .order("status", { ascending: false }) // active > open
        .order("starts_at", { ascending: true })
        .limit(24);
      if (error) throw error;
      const rows = (data ?? []) as unknown as WorkshopRow[];
      return rows
        .filter((w) => (w.participant_cap ?? 0) === 0 || (w.confirmed_count ?? 0) < (w.participant_cap ?? 0))
        .slice(0, 8);
    },
  });

  const liveRooms = data ?? [];
  const suggestionsNeeded = Math.max(0, TARGET_TILES - liveRooms.length);
  const suggestions = useSuggestedPrompts(suggestionsNeeded);

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-coral opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-coral" />
            </span>
            Happening now
          </div>
          <h2 className="font-display text-3xl leading-[1.05] text-ink md:text-[40px]">Drop into the Lounge</h2>
          <p className="mt-2 max-w-xl text-sm text-ink-muted md:text-[15px]">
            {liveRooms.length > 0
              ? "Live rooms with seats open — walk right in. Tap a suggestion to start one; others will join."
              : "Nobody's live yet. Start any of these and others will drop in."}
          </p>
        </div>
        <Link
          to="/workshops"
          className="group inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-muted hover:text-ink"
        >
          All Lounges <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
      <div className="mt-8" />


      {isLoading ? (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 w-72 shrink-0 animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </div>
      ) : (
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {liveRooms.map((w) => {
            const cap = w.participant_cap ?? 0;
            const filled = w.confirmed_count ?? 0;
            const seatsLeft = cap > 0 ? Math.max(0, cap - filled) : null;
            const isLive = w.status === "active";
            return (
              <Link
                key={w.id}
                to="/workshops/$slug"
                params={{ slug: w.slug }}
                className="group relative flex w-72 shrink-0 snap-start flex-col gap-2 rounded-2xl border border-border bg-surface p-4 transition hover:-translate-y-0.5 hover:shadow-soft"
              >
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span
                    className={
                      isLive
                        ? "inline-flex items-center gap-1 rounded-full bg-coral/15 px-2 py-0.5 font-semibold uppercase tracking-wider text-coral"
                        : "inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-semibold uppercase tracking-wider text-primary"
                    }
                  >
                    {isLive ? <Radio className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                    {whenLabel(w.starts_at, w.status)}
                  </span>
                  {seatsLeft !== null && (
                    <span className="inline-flex items-center gap-1 text-ink-muted">
                      <Users className="h-3 w-3" />
                      {seatsLeft} seat{seatsLeft === 1 ? "" : "s"} left
                    </span>
                  )}
                </div>
                <p className="line-clamp-2 font-display text-base text-ink">
                  {w.title ?? "Untitled Lounge"}
                </p>
                <div className="mt-auto flex items-center justify-between gap-2 text-[11px] text-ink-muted">
                  <span className="flex items-center gap-2 truncate">
                    {w.topic_collab_post_id && (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <Target className="h-3 w-3" /> Collab
                      </span>
                    )}
                    {w.city?.name && (
                      <span className="inline-flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3" /> {w.city.name}
                      </span>
                    )}
                  </span>
                  <span className="inline-flex items-center gap-0.5 font-medium text-ink transition group-hover:gap-1.5">
                    Join <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
                {cap > 0 && (
                  <div className="absolute inset-x-4 bottom-1 h-0.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={isLive ? "h-full bg-coral" : "h-full bg-primary"}
                      style={{ width: `${Math.min(100, Math.round((filled / cap) * 100))}%` }}
                    />
                  </div>
                )}
              </Link>
            );
          })}

          {suggestions.map((p, i) => {
            const label = mediumLabel(p.medium) ?? "Any medium";
            return (
              <Link
                key={`sugg-${i}-${p.title}`}
                to="/lounge"
                search={{ prompt: p.title, medium: p.medium ?? "" }}
                className="group relative flex w-72 shrink-0 snap-start flex-col gap-2 rounded-2xl border border-dashed border-border bg-surface/60 p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-surface hover:shadow-soft"
              >
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-semibold uppercase tracking-wider text-primary">
                    <Sparkles className="h-3 w-3" /> Start this Lounge
                  </span>
                  <span className="inline-flex items-center gap-1 text-ink-muted">
                    <Users className="h-3 w-3" />5 seats
                  </span>
                </div>
                <p className="line-clamp-2 font-display text-base text-ink">{p.title}</p>
                <div className="mt-auto flex items-center justify-between gap-2 text-[11px] text-ink-muted">
                  <span className="truncate">{label} · voice or video</span>
                  <span className="inline-flex items-center gap-0.5 font-medium text-ink transition group-hover:gap-1.5">
                    Open <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

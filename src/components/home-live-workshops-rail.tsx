import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Radio, Users, ArrowRight, MapPin, Target, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

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
      // Only those that still need seats.
      return rows
        .filter((w) => (w.participant_cap ?? 0) === 0 || (w.confirmed_count ?? 0) < (w.participant_cap ?? 0))
        .slice(0, 8);
    },
  });

  const isEmpty = !isLoading && (!data || data.length === 0);

  return (
    <section className="mx-auto max-w-7xl px-4 pt-10 pb-10 md:px-6 md:pt-14 md:pb-14">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-3xl text-ink md:text-4xl flex items-center gap-2">
            <span className="relative inline-flex h-2.5 w-2.5">
              <span className="absolute inset-0 rounded-full bg-coral animate-ping opacity-60" />
              <span className="relative inline-block h-2.5 w-2.5 rounded-full bg-coral" />
            </span>
            Workshops
          </h2>
          <p className="mt-1 text-sm text-ink-muted">Live rooms with seats open. Walk right in.</p>
        </div>
        <Link
          to="/workshops"
          className="hidden sm:inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-ink-soft hover:bg-muted transition"
        >
          All workshops <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {isLoading ? (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 w-72 shrink-0 animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="rounded-3xl border border-dashed border-border bg-surface p-12 text-center">
          <h3 className="font-display text-2xl text-ink">No live Workshops right now.</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
            Start one — five seats, shared tools, anyone can drop in.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Link to="/workshop">
              <Button className="rounded-full">Start a Workshop</Button>
            </Link>
            <Link
              to="/workshops"
              className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink transition"
            >
              Browse scheduled <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {data!.map((w) => {
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
                  {w.title ?? "Untitled workshop"}
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
        </div>
      )}
    </section>
  );
}

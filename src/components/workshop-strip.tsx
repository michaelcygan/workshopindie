import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, CalendarClock, MapPin, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useDefaultCity } from "@/hooks/use-default-city";
import { InstantActivityTicker } from "@/components/instant-activity-ticker";
import { cn } from "@/lib/utils";

type Pill = "live" | "upcoming" | "city" | "mine";

type ScheduledRow = {
  id: string;
  slug: string;
  title: string;
  starts_at: string | null;
  city_id: string | null;
  topic_collab_post_id: string | null;
};

function fmtWhen(iso: string | null) {
  if (!iso) return "Soon";
  const d = new Date(iso);
  const diff = d.getTime() - Date.now();
  const mins = Math.round(diff / 60_000);
  if (mins < 0) return "Live now";
  if (mins < 60) return `in ${mins}m`;
  if (mins < 60 * 24) return `in ${Math.round(mins / 60)}h`;
  return d.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

function ScheduledList({ cityId, mineUserId }: { cityId?: string | null; mineUserId?: string | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ["scheduled-workshops", mineUserId ? `mine:${mineUserId}` : (cityId ?? "all")],
    queryFn: async () => {
      if (mineUserId) {
        // User's own RSVPs (incl. workshops they host) — upcoming only.
        const [partRes, hostRes] = await Promise.all([
          supabase
            .from("workshop_participants")
            .select("workshop:workshops!workshop_participants_workshop_id_fkey(id,slug,title,starts_at,city_id,topic_collab_post_id,status,mode,host_user_id)")
            .eq("user_id", mineUserId)
            .in("participant_status", ["confirmed", "checked_in"]),
          supabase
            .from("workshops")
            .select("id,slug,title,starts_at,city_id,topic_collab_post_id,status,mode,host_user_id")
            .eq("host_user_id", mineUserId)
            .eq("mode", "scheduled")
            .in("status", ["open", "check_in", "active"])
            .gte("starts_at", new Date().toISOString()),
        ]);
        const merged = new Map<string, ScheduledRow>();
        for (const r of (partRes.data ?? []) as Array<{ workshop: ScheduledRow | null }>) {
          const w = r.workshop;
          if (!w || !w.starts_at) continue;
          if (new Date(w.starts_at).getTime() < Date.now()) continue;
          if (!["open", "check_in", "active"].includes(w.status ?? "")) continue;
          merged.set(w.id, w);
        }
        for (const w of (hostRes.data ?? []) as ScheduledRow[]) {
          merged.set(w.id, w);
        }
        return Array.from(merged.values()).sort(
          (a, b) => new Date(a.starts_at ?? 0).getTime() - new Date(b.starts_at ?? 0).getTime(),
        );
      }
      let q = supabase
        .from("workshops")
        .select("id,slug,title,starts_at,city_id,topic_collab_post_id,status,mode,host_user_id")
        .eq("mode", "scheduled")
        .eq("visibility", "public")
        .in("status", ["open", "check_in", "active"])
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(12);
      if (cityId) q = q.eq("city_id", cityId);
      const { data, error } = await q;
      if (error) throw error;
      return data as ScheduledRow[];
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-2xl bg-surface-2" />
        ))}
      </div>
    );
  }
  if (!data || data.length === 0) {
    if (mineUserId) {
      return (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center text-sm text-ink-muted">
          No RSVPs yet. Browse workshops from a profile or city page — they'll show up here.
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center text-sm text-ink-muted">
        Nothing scheduled {cityId ? "in your city" : "yet"}.{" "}
        <Link to="/collab/new" className="underline hover:text-ink">Post a Collab</Link> and pick a time — or just drop in.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {data.map((w) => (
        <li key={w.id}>
          <Link
            to="/workshops/$slug"
            params={{ slug: w.slug }}
            className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3 transition hover:bg-muted"
          >
            <span className="truncate text-sm text-ink">{w.title}</span>
            <span className="ml-3 shrink-0 text-xs text-ink-muted">{fmtWhen(w.starts_at)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function useCounts(cityId?: string | null) {
  return useQuery({
    queryKey: ["workshop-strip-counts", cityId ?? "all"],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const [live, upcoming, city] = await Promise.all([
        supabase
          .from("instant_rooms")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        supabase
          .from("workshops")
          .select("id", { count: "exact", head: true })
          .eq("mode", "scheduled")
          .eq("visibility", "public")
          .in("status", ["open", "check_in", "active"])
          .gte("starts_at", nowIso),
        cityId
          ? supabase
              .from("workshops")
              .select("id", { count: "exact", head: true })
              .eq("mode", "scheduled")
              .eq("visibility", "public")
              .in("status", ["open", "check_in", "active"])
              .gte("starts_at", nowIso)
              .eq("city_id", cityId)
          : Promise.resolve({ count: 0 }),
      ]);
      return { live: live.count ?? 0, upcoming: upcoming.count ?? 0, city: city.count ?? 0 };
    },
    refetchInterval: 30_000,
  });
}

export function WorkshopStrip() {
  const [active, setActive] = useState<Pill>("live");
  const { data: defaultCity } = useDefaultCity();
  const cityId = defaultCity?.city?.id ?? null;
  const cityName = defaultCity?.city?.name ?? null;
  const { data: counts } = useCounts(cityId);

  const pills: { id: Pill; label: string; count: number; icon: React.ReactNode; show: boolean }[] = [
    { id: "live", label: "Live now", count: counts?.live ?? 0, icon: <Radio className="h-3.5 w-3.5" />, show: true },
    { id: "upcoming", label: "Upcoming", count: counts?.upcoming ?? 0, icon: <CalendarClock className="h-3.5 w-3.5" />, show: true },
    { id: "city", label: cityName ? `In ${cityName}` : "In your city", count: counts?.city ?? 0, icon: <MapPin className="h-3.5 w-3.5" />, show: !!cityId },
  ];

  return (
    <div className="mt-10">
      <div className="flex flex-wrap gap-1.5">
        {pills.filter((p) => p.show).map((p) => (
          <button
            key={p.id}
            onClick={() => setActive(p.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition",
              active === p.id
                ? "border-transparent bg-ink text-background"
                : "border-border bg-surface text-ink-soft hover:bg-muted",
            )}
          >
            {p.icon}
            <span>{p.label}</span>
            <span className={cn("tabular-nums", active === p.id ? "opacity-80" : "text-ink-muted")}>
              {p.count}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-4 min-h-[7rem]">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {active === "live" ? (
              <InstantActivityTicker />
            ) : active === "upcoming" ? (
              <ScheduledList />
            ) : (
              <ScheduledList cityId={cityId} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  group: { id: string; slug: string };
}

type EventRow = {
  id: string;
  slug: string;
  title: string;
  starts_at: string;
  venue_name: string | null;
  going_count: number | null;
  cover_url: string | null;
};

function formatWhen(iso: string): { day: string; time: string; relative: string } {
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const diffMs = d.getTime() - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  let relative = "";
  if (diffMs < 0) relative = "now";
  else if (diffDays === 0) relative = "today";
  else if (diffDays === 1) relative = "tomorrow";
  else if (diffDays < 7) relative = `in ${diffDays} days`;
  else if (diffDays < 30) relative = `in ${Math.round(diffDays / 7)} wk`;
  else relative = `in ${Math.round(diffDays / 30)} mo`;
  return { day, time, relative };
}

export function GroupNextEvent({ group }: Props) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["group", group.id, "upcoming-events"],
    queryFn: async (): Promise<EventRow[]> => {
      const { data, error } = await supabase
        .from("group_events")
        .select("id,slug,title,starts_at,venue_name,going_count,cover_url")
        .eq("group_id", group.id)
        .is("deleted_at", null)
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(3);
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  return (
    <section className="rounded-3xl border border-border bg-surface p-4">
      <header className="mb-3 flex items-center gap-2">
        <Calendar className="h-4 w-4 text-primary" />
        <h3 className="font-display text-base text-ink">Upcoming events</h3>
      </header>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-14 animate-pulse rounded-xl bg-muted/40" />
          <div className="h-14 animate-pulse rounded-xl bg-muted/40" />
        </div>
      ) : events.length > 0 ? (
        <ul className="space-y-2">
          {events.map((event) => {
            const when = formatWhen(event.starts_at);
            return (
              <li key={event.id}>
                <Link
                  to="/g/$slug/e/$eventSlug"
                  params={{ slug: group.slug, eventSlug: event.slug }}
                  className="flex items-start gap-2.5 rounded-xl border border-border p-2 transition hover:border-primary/40 hover:bg-muted/30"
                >
                  <div
                    className="h-10 w-10 shrink-0 rounded-md bg-muted bg-cover bg-center"
                    style={event.cover_url ? { backgroundImage: `url(${event.cover_url})` } : undefined}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-1 text-sm font-medium text-ink">{event.title}</div>
                    <div className="mt-0.5 text-[11px] text-ink-muted">
                      {when.day} · {when.time} <span className="text-primary">· {when.relative}</span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">No upcoming events.</p>
      )}

      <Link
        to="/g/$slug"
        params={{ slug: group.slug }}
        search={{ tab: "events" } as never}
        className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-ink-soft hover:text-ink"
      >
        All events <ArrowRight className="h-3 w-3" />
      </Link>
    </section>
  );
}

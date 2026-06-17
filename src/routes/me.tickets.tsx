import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Calendar, Ticket, MapPin, Radio } from "lucide-react";
import { listMyUpcomingRsvps } from "@/lib/group-events.functions";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/me/tickets")({
  component: MyTicketsPage,
  head: () => ({
    meta: [
      { title: "Your tickets — Workshop" },
      { name: "description", content: "Upcoming events you've RSVP'd to." },
    ],
  }),
});

function MyTicketsPage() {
  const { user } = useAuth();
  const fetchFn = useServerFn(listMyUpcomingRsvps);
  const { data, isLoading } = useQuery({
    queryKey: ["my-tickets", user?.id],
    enabled: !!user,
    queryFn: () => fetchFn(),
  });

  if (!user) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-display text-3xl text-ink">Sign in to see your tickets.</h1>
        <Link to="/login" className="mt-4 inline-block rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">Sign in</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="rounded-2xl bg-primary/10 p-2.5"><Ticket className="h-6 w-6 text-primary" /></div>
        <div>
          <h1 className="font-display text-3xl text-ink">Your tickets</h1>
          <p className="text-sm text-ink-muted">Upcoming events you've RSVP'd to.</p>
        </div>
      </div>

      {isLoading && <p className="text-sm text-ink-muted">Loading…</p>}
      {!isLoading && (!data || data.length === 0) && (
        <div className="rounded-3xl border border-dashed border-border bg-surface p-10 text-center">
          <p className="text-ink-soft">No upcoming events yet.</p>
          <Link to="/groups" className="mt-3 inline-block text-sm text-primary underline">Browse groups</Link>
        </div>
      )}

      <ul className="space-y-3">
        {(data ?? []).map((r) => {
          type R = { status: string; plus_ones: number; event: { id: string; slug: string; title: string; starts_at: string; format: string; venue_name: string | null; venue_address: string | null; online_url: string | null; group: { slug: string; name: string } } };
          const row = r as unknown as R;
          const ev = row.event;
          const starts = new Date(ev.starts_at);
          return (
            <li key={ev.id}>
              <Link
                to="/g/$slug/e/$eventSlug"
                params={{ slug: ev.group.slug, eventSlug: ev.slug }}
                className="flex gap-4 rounded-2xl border border-border bg-surface p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-muted text-center">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">
                    {starts.toLocaleDateString(undefined, { month: "short" })}
                  </span>
                  <span className="font-display text-xl leading-none text-ink">{starts.getDate()}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-base text-ink line-clamp-1">{ev.title}</div>
                  <div className="text-xs text-ink-muted">{ev.group.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {starts.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      {ev.format === "online" ? <Radio className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                      {ev.format === "online" ? "Online" : (ev.venue_name ?? ev.venue_address ?? "TBA")}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{row.status}</span>
                  </div>
                </div>
                <a
                  href={`/api/public/events/${ev.id}/ics`}
                  onClick={(e) => e.stopPropagation()}
                  className="self-center text-xs text-primary hover:underline"
                >
                  .ics
                </a>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

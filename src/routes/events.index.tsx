import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Calendar, MapPin, Radio, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EventCard, type EventCardData } from "@/components/event-card";
import { cn } from "@/lib/utils";

// Public events feed. Lives alongside group-scoped events so that:
//  • Drop-in visitors (incl. logged-out) have a single, scannable "what's
//    happening" surface — the launch on-ramp.
//  • Groups still own their event pages and benefit from the auto-join on RSVP.
// Filters are intentionally minimal for v1: format (all/in-person/online) and
// time window (upcoming/past). No city filter, no kind filter — keep it simple.

type Format = "all" | "in_person" | "online";
type When = "upcoming" | "past";

async function fetchPublicEvents(when: When, format: Format) {
  const now = new Date().toISOString();
  let q = supabase
    .from("group_events")
    .select(
      "id,slug,title,tagline,kind,format,cover_url,accent_color,starts_at,venue_name,venue_address,going_count,capacity,featured_at,promo_pass_months,group:groups!inner(slug,name,avatar_url,visibility,deleted_at)",
    )
    .is("deleted_at", null)
    .eq("visibility", "public")
    .in("status", ["scheduled", "live", "completed"]);

  q = when === "upcoming"
    ? q.gte("starts_at", now).order("starts_at", { ascending: true })
    : q.lt("starts_at", now).order("starts_at", { ascending: false });

  if (format === "in_person") q = q.in("format", ["in_person", "hybrid"]);
  if (format === "online") q = q.in("format", ["online", "hybrid"]);

  const { data, error } = await q.limit(60);
  if (error) throw error;
  // Filter out events whose host group is soft-deleted (RLS belt-and-braces).
  return (data ?? []).filter((e) => {
    const g = (e as unknown as { group: { deleted_at: string | null } | null }).group;
    return g && !g.deleted_at;
  }) as unknown as EventCardData[];
}

export const Route = createFileRoute("/events/")({
  component: EventsIndexPage,
  head: () => ({
    meta: [
      { title: "Events — Workshop" },
      {
        name: "description",
        content:
          "Listening parties, work-in-progress nights, networking — public events for creatives on Workshop.",
      },
      { property: "og:title", content: "Events on Workshop" },
      {
        property: "og:description",
        content: "Find creative events near you and online.",
      },
    ],
  }),
});

function EventsIndexPage() {
  const [when, setWhen] = useState<When>("upcoming");
  const [format, setFormat] = useState<Format>("all");

  const { data: events, isLoading } = useQuery({
    queryKey: ["public-events", when, format],
    queryFn: () => fetchPublicEvents(when, format),
    staleTime: 60_000,
  });

  const featured = useMemo(
    () => (events ?? []).filter((e) => e.featured_at).slice(0, 3),
    [events],
  );
  const rest = useMemo(
    () => (events ?? []).filter((e) => !featured.find((f) => f.id === e.id)),
    [events, featured],
  );

  return (
    <main className="mx-auto max-w-7xl px-4 pb-20 pt-10 md:px-6">
      <header className="mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink md:text-5xl">Events</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted md:text-base">
            Listening parties, work-in-progress nights, networking. Drop in,
            meet people building things, and bring something of your own.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SegToggle
            value={when}
            onChange={setWhen}
            options={[
              { value: "upcoming", label: "Upcoming" },
              { value: "past", label: "Past" },
            ]}
          />
          <SegToggle
            value={format}
            onChange={setFormat}
            options={[
              { value: "all", label: "All", icon: Calendar },
              { value: "in_person", label: "In person", icon: MapPin },
              { value: "online", label: "Online", icon: Radio },
            ]}
          />
        </div>
      </header>

      {featured.length > 0 && when === "upcoming" && (
        <section className="mb-10">
          <h2 className="mb-3 inline-flex items-center gap-1.5 font-display text-lg text-ink">
            <Sparkles className="h-4 w-4 text-primary" /> Featured
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}

      <section>
        {isLoading && <p className="text-sm text-ink-muted">Loading events…</p>}
        {!isLoading && (events ?? []).length === 0 && (
          <div className="rounded-3xl border border-dashed border-border bg-surface p-10 text-center">
            <p className="text-sm text-ink-muted">
              {when === "upcoming"
                ? "No events scheduled right now. Check back soon — or browse "
                : "Nothing here yet. Try "}
              <Link to="/groups" className="text-primary underline">
                Groups
              </Link>
              {when === "upcoming" ? " to find a scene." : " to find a scene."}
            </p>
          </div>
        )}
        {rest.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function SegToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: React.ComponentType<{ className?: string }> }[];
}) {
  return (
    <div className="inline-flex rounded-full bg-muted p-1 text-xs">
      {options.map((o) => {
        const Icon = o.icon;
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-medium transition",
              active ? "bg-surface text-ink shadow-soft" : "text-ink-soft hover:text-ink",
            )}
          >
            {Icon && <Icon className="h-3 w-3" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

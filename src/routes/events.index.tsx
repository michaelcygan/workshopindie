import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Calendar, MapPin, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EventCard, type EventCardData } from "@/components/event-card";
import { PageHeaderCompact } from "@/components/page-header-compact";
import { KickerChip } from "@/components/kicker-chip";
import { RecapChip } from "@/components/recap-chip";
import { EmptySpark } from "@/components/empty-spark";
import { YourGroupsStrip } from "@/components/your-groups-strip";
import { FeaturedEventsCompact } from "@/components/featured-events-compact";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Public events feed. Drop-in surface for visitors and logged-out crawlers —
// groups still own their event pages and RSVP still auto-joins the host group.

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
          "Listening parties, work-in-progress nights, networking. Public creative events on Workshop.",
      },
      { property: "og:title", content: "Events — Workshop" },
      {
        property: "og:description",
        content:
          "Listening parties, work-in-progress nights, networking. Public creative events on Workshop.",
      },
      { property: "og:url", content: "https://workshopindie.com/events" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Events — Workshop" },
      {
        name: "twitter:description",
        content: "Find creative events near you and online.",
      },
    ],
    links: [{ rel: "canonical", href: "https://workshopindie.com/events" }],
  }),
});

// --- Week bucketing -------------------------------------------------------
function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay(); // 0 = Sun
  const diff = (day + 6) % 7; // ISO week starts Monday
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - diff);
  return x;
}
function bucketLabel(eventDate: Date, when: When): string {
  if (when === "past") {
    return `Past — ${eventDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}`;
  }
  const now = new Date();
  const thisWeek = startOfWeek(now);
  const evWeek = startOfWeek(eventDate);
  const weeksOut = Math.round((evWeek.getTime() - thisWeek.getTime()) / (7 * 24 * 60 * 60 * 1000));
  if (weeksOut <= 0) return "This week";
  if (weeksOut === 1) return "Next week";
  return `Week of ${evWeek.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function EventsIndexPage() {
  const [when, setWhen] = useState<When>("upcoming");
  const [format, setFormat] = useState<Format>("all");

  const { data: events, isLoading } = useQuery({
    queryKey: ["public-events", when, format],
    queryFn: () => fetchPublicEvents(when, format),
    staleTime: 60_000,
  });

  const list = events ?? [];
  const happeningCount = useMemo(() => {
    const now = Date.now();
    return list.filter((e) => {
      const t = new Date(e.starts_at).getTime();
      return t <= now && t >= now - 1000 * 60 * 60 * 4;
    }).length;
  }, [list]);

  const buckets = useMemo(() => {
    const map = new Map<string, EventCardData[]>();
    for (const e of list) {
      const label = bucketLabel(new Date(e.starts_at), when);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(e);
    }
    return Array.from(map.entries());
  }, [list, when]);

  const jsonLd = useMemo(() => {
    if (when !== "upcoming" || list.length === 0) return null;
    return {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: list.slice(0, 30).map((e, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `https://workshopindie.com/g/${e.group.slug}/e/${e.slug}`,
        name: e.title,
      })),
    };
  }, [list, when]);

  return (
    <>
      <YourGroupsStrip />
      <main className="mx-auto max-w-7xl px-4 pb-20 pt-6 md:px-6 md:pt-10">
        <PageHeaderCompact
          title="Events"
          backTo="/"
          backLabel="Home"
          right={
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link to="/groups">Host an event</Link>
            </Button>
          }
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <KickerChip live={happeningCount > 0}>
            {happeningCount > 0 ? `${happeningCount} happening now` : "On the calendar"}
          </KickerChip>
          <RecapChip count={list.length} label={when === "upcoming" ? "upcoming" : "past"} />
        </div>
        <p className="mt-3 max-w-2xl text-sm text-ink-muted md:text-base">
          Listening parties, work-in-progress nights, networking. Drop in, meet
          people building things, and bring something of your own.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
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

        {when === "upcoming" && (
          <section className="mt-8">
            <FeaturedEventsCompact />
          </section>
        )}

        <section className="mt-10">
          {isLoading && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-56 animate-pulse rounded-3xl border border-border bg-muted/30"
                />
              ))}
            </div>
          )}

          {!isLoading && list.length === 0 && (
            <EmptySpark
              title="Nothing on the calendar."
              body="Scenes post events from their Group page. Find one that fits and the next thing on the books will land here."
              action={
                <Button asChild className="rounded-full">
                  <Link to="/groups">Browse Groups</Link>
                </Button>
              }
            />
          )}

          {!isLoading && buckets.length > 0 && (
            <div className="space-y-10">
              {buckets.map(([label, items]) => (
                <div key={label}>
                  <div className="mb-3 flex items-baseline justify-between">
                    <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-soft">
                      {label}
                    </h2>
                    <span className="text-[11px] text-ink-muted">{items.length}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((e) => (
                      <EventCard key={e.id} event={e} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {jsonLd && (
          <script
            type="application/ld+json"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        )}
      </main>
    </>
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
    <div className="inline-flex rounded-full border border-border bg-surface p-1 text-xs shadow-soft">
      {options.map((o) => {
        const Icon = o.icon;
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition",
              active ? "bg-ink text-surface shadow-soft" : "text-ink-soft hover:text-ink",
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

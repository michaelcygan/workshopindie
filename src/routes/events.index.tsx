import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { Calendar, MapPin, Radio, Ticket } from "lucide-react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { EventCard, type EventCardData } from "@/components/event-card";
import { PageHeaderCompact } from "@/components/page-header-compact";
import { KickerChip } from "@/components/kicker-chip";
import { EmptySpark } from "@/components/empty-spark";
import { YourGroupsStrip } from "@/components/your-groups-strip";
import { FeaturedEventsCompact } from "@/components/featured-events-compact";
import { CityCombobox, type CityValue } from "@/components/city-combobox";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useDefaultCity, useApplyDefaultCity } from "@/hooks/use-default-city";
import { listMyUpcomingRsvps, listMyPastRsvps } from "@/lib/group-events.functions";
import { cn } from "@/lib/utils";


// Public events feed. Drop-in surface for visitors and logged-out crawlers —
// groups still own their event pages and RSVP still auto-joins the host group.

type Format = "all" | "in_person" | "online";
type When = "upcoming" | "past";

const searchSchema = z.object({
  when: fallback(z.enum(["upcoming", "past"]), "upcoming").default("upcoming"),
  format: fallback(z.enum(["all", "in_person", "online"]), "all").default("all"),
  city: z.string().uuid().catch(undefined as unknown as string).optional(),
  cityName: z.string().catch(undefined as unknown as string).optional(),
  mine: fallback(z.boolean(), false).default(false),
});


async function fetchPublicEvents(when: When, format: Format, cityId?: string) {
  const now = new Date().toISOString();
  let q = supabase
    .from("group_events")
    .select(
      "id,slug,title,tagline,kind,format,cover_url,accent_color,starts_at,venue_name,venue_address,venue_city_id,going_count,capacity,featured_at,promo_pass_months,group:groups!inner(slug,name,avatar_url,visibility,deleted_at)",
    )
    .is("deleted_at", null)
    .eq("visibility", "public")
    .in("status", ["scheduled", "live", "completed"]);

  q = when === "upcoming"
    ? q.gte("starts_at", now).order("starts_at", { ascending: true })
    : q.lt("starts_at", now).order("starts_at", { ascending: false });

  if (format === "in_person") q = q.in("format", ["in_person", "hybrid"]);
  if (format === "online") q = q.in("format", ["online", "hybrid"]);

  if (cityId && format !== "online") q = q.eq("venue_city_id", cityId);

  const { data, error } = await q.limit(60);
  if (error) throw error;
  return (data ?? []).filter((e) => {
    const g = (e as unknown as { group: { deleted_at: string | null } | null }).group;
    return g && !g.deleted_at;
  }) as unknown as EventCardData[];
}

export const Route = createFileRoute("/events/")({
  validateSearch: zodValidator(searchSchema),
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

type SearchShape = z.infer<typeof searchSchema>;

function EventsIndexPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/events" });
  const { when, format, city: cityId, cityName, mine } = search;
  const { user } = useAuth();

  const mineUpcomingFn = useServerFn(listMyUpcomingRsvps);
  const minePastFn = useServerFn(listMyPastRsvps);

  const mineActive = mine && !!user;

  const { data: publicData, isLoading: publicLoading } = useQuery({
    queryKey: ["public-events", when, format, cityId ?? null],
    queryFn: () => fetchPublicEvents(when, format, cityId),
    staleTime: 60_000,
    enabled: !mineActive,
  });

  const { data: mineData, isLoading: mineLoading } = useQuery({
    queryKey: ["my-rsvps-feed", when, user?.id],
    queryFn: async () => {
      const rows = when === "past" ? await minePastFn() : await mineUpcomingFn();
      type R = { event: EventCardData };
      return (rows as unknown as R[]).map((r) => r.event);
    },
    staleTime: 30_000,
    enabled: mineActive,
  });

  const events = mineActive ? mineData : publicData;
  const isLoading = mineActive ? mineLoading : publicLoading;
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

  function setWhen(next: When) {
    navigate({ search: (prev: SearchShape) => ({ ...prev, when: next }) });
  }
  function setFormat(next: Format) {
    navigate({
      search: (prev: SearchShape) => ({
        ...prev,
        format: next,
        // Online ignores city.
        city: next === "online" ? undefined : prev.city,
        cityName: next === "online" ? undefined : prev.cityName,
      }),
    });
  }
  function setCity(next: CityValue | null) {
    navigate({
      search: (prev: SearchShape) => ({
        ...prev,
        city: next?.id,
        cityName: next?.name,
      }),
    });
  }
  function setMine(next: boolean) {
    navigate({ search: (prev: SearchShape) => ({ ...prev, mine: next }) });
  }



  const cityValue: CityValue | null = cityId && cityName ? { id: cityId, name: cityName } : null;

  const defaultCityQuery = useDefaultCity();
  const defaultCity = defaultCityQuery.data?.city ?? null;
  useApplyDefaultCity({
    feedKey: "events",
    isWorldwide: !cityId && format !== "online",
    apply: (city) => setCity({ id: city.id, name: city.name }),
    defaultCity,
  });

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

        {/* Compact meta row — mirrors the Collab Board */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <KickerChip live={happeningCount > 0}>
            {happeningCount > 0 ? `${happeningCount} happening now` : "On the calendar"}
          </KickerChip>
          <p className="text-sm text-ink-muted">
            Networking, listening parties, work-in-progress nights — RSVP unlocks a free trial.
          </p>
          {list.length > 0 && (
            <span className="ml-auto rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] font-medium text-ink-soft">
              {list.length} {when}
            </span>
          )}
        </div>

        {/* Unified filter cluster */}
        <div className="mx-auto mt-5 max-w-5xl space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <SegToggle
              value={when}
              onChange={setWhen}
              options={[
                { value: "upcoming", label: "Upcoming" },
                { value: "past", label: "Past" },
              ]}
            />
            {user && (
              <button
                type="button"
                onClick={() => setMine(!mine)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-soft transition",
                  mine
                    ? "border-ink bg-ink text-surface"
                    : "border-border bg-surface text-ink-soft hover:text-ink",
                )}
                aria-pressed={mine}
              >
                <Ticket className="h-3 w-3" />
                My RSVPs
              </button>
            )}

            {!mineActive && (
              <>
                <SegToggle
                  value={format}
                  onChange={setFormat}
                  options={[
                    { value: "all", label: "All", icon: Calendar },
                    { value: "in_person", label: "In person", icon: MapPin },
                    { value: "online", label: "Online", icon: Radio },
                  ]}
                />
                <div className="flex min-w-[16rem] flex-1 items-center gap-2">
                  <CityCombobox
                    value={cityValue}
                    onChange={setCity}
                    disabled={format === "online"}
                    placeholder="Anywhere — search a city"
                  />
                  {cityValue && format !== "online" && (
                    <button
                      type="button"
                      onClick={() => setCity(null)}
                      className="h-11 shrink-0 rounded-full border border-border bg-surface px-4 text-sm font-medium text-ink-soft shadow-soft transition hover:bg-muted"
                    >
                      Worldwide
                    </button>
                  )}
                </div>
              </>
            )}
          </div>


          {!mineActive && defaultCity && cityId === defaultCity.id && defaultCity.source === "ip" && (
            <p className="px-1 text-xs text-ink-muted">
              Based on your location ·{" "}
              <button
                type="button"
                onClick={() => setCity(null)}
                className="underline underline-offset-2 hover:text-ink"
              >
                see worldwide
              </button>
            </p>
          )}
          {!mineActive && !cityId && format !== "online" && defaultCity && (
            <p className="px-1 text-xs text-ink-muted">
              Near you:{" "}
              <button
                type="button"
                onClick={() => setCity({ id: defaultCity.id, name: defaultCity.name })}
                className="text-ink underline underline-offset-2 hover:text-primary"
              >
                {defaultCity.name}
              </button>
            </p>
          )}

        </div>

        {when === "upcoming" && !mineActive && (
          <section className="mt-6">
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
              title={mineActive ? "No RSVPs yet." : "Nothing on the calendar."}
              body={
                mineActive
                  ? when === "past"
                    ? "Events you attend will show up here."
                    : "RSVP to an event and it'll appear here for quick access."
                  : cityValue
                    ? `No ${when} events in ${cityValue.name} yet. Try Worldwide or a different city.`
                    : "Events hosted by the Groups you join will list here."
              }
              action={
                <Button asChild className="rounded-full" onClick={() => mineActive && setMine(false)}>
                  <Link to={mineActive ? "/events" : "/groups"} search={mineActive ? { mine: false } as never : undefined}>
                    {mineActive ? "Browse events" : "Browse Groups"}
                  </Link>
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

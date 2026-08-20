/**
 * The one Events calendar.
 *
 * Rendered by `/events` and by `/events/remote` — the second is this same
 * directory with the existing online attendance filter (format = online, which
 * covers `online` and `hybrid` rows) active on entry. There is no second feed,
 * card, event page or authoring flow: the route only decides the initial
 * attendance state, the copy, and how attendance changes navigate.
 */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { Calendar, MapPin, Radio } from "lucide-react";
import { EventCard, type EventCardData } from "@/components/event-card";
import { PageHeaderCompact } from "@/components/page-header-compact";
import { KickerChip } from "@/components/kicker-chip";
import { EmptySpark } from "@/components/empty-spark";
import { YourGroupsStrip } from "@/components/your-groups-strip";
import { FeaturedEventsCompact } from "@/components/featured-events-compact";
import {
  EventsMiniMap,
  type MapCityPoint,
  type MapVenuePoint,
} from "@/components/events/events-mini-map";
import {
  FILTER_ROW_SCROLL,
  FilterClear,
  FilterHeader,
  FilterPillToggle,
  FilterSearch,
  FilterSelect,
  FilterToggleGroup,
} from "@/components/filter-header";
import { FilterCityPicker, type FilterCityOption } from "@/components/filter-header/filter-city-picker";
import { FilterMore, FilterMoreSection, FilterMoreToggle } from "@/components/filter-header/filter-more";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useDefaultCity, useApplyDefaultCity } from "@/hooks/use-default-city";
import {
  listMyUpcomingRsvps,
  listMyPastRsvps,
  listPublicEvents,
  listEventMapPoints,
  listEventCities,
  listEventMediums,
  listEventTopics,
} from "@/lib/group-events.functions";
import { workshopEntityUrl } from "@/lib/entities/kinds";

// Public events feed. Drop-in surface for visitors and logged-out crawlers —
// groups still own their event pages and RSVP still auto-joins the host group.

/** Attendance filter. `online` means "remotely attendable": online + hybrid. */
export type Format = "all" | "in_person" | "online";
export type When = "upcoming" | "past";

/** Everything the directory reads out of the URL, minus attendance itself. */
export type DirectorySearch = {
  when: When;
  city?: string;
  cityName?: string;
  q: string;
  medium: string;
  topic: string;
  mine: boolean;
  kind: "all" | "coworking";
  daypart: "all" | "morning" | "afternoon" | "evening";
};

export type EventsDirectoryProps = {
  search: DirectorySearch;
  format: Format;
  /** True on `/events/remote`: city is not a constraint and never defaults. */
  remote: boolean;
  title: string;
  description: string;
  emptyTitle: string;
  emptyBody: string;
  onPatch: (next: Partial<DirectorySearch>) => void;
  onFormatChange: (next: Format) => void;
  onClear: () => void;
};

async function fetchPublicEvents(
  fn: (opts: {
    data: {
      when: When;
      format: Format;
      cityId?: string | null;
      kind?: string | null;
      daypart?: "morning" | "afternoon" | "evening" | null;
      medium?: string | null;
      topic?: string | null;
      q?: string | null;
    };
  }) => Promise<unknown>,
  args: {
    when: When;
    format: Format;
    cityId?: string;
    kind?: string;
    daypart?: string;
    medium?: string;
    topic?: string;
    q?: string;
  },
) {
  const rows = await fn({
    data: {
      when: args.when,
      format: args.format,
      cityId: args.cityId ?? null,
      kind: args.kind && args.kind !== "all" ? args.kind : null,
      daypart:
        args.daypart && args.daypart !== "all"
          ? (args.daypart as "morning" | "afternoon" | "evening")
          : null,
      medium: args.medium ? args.medium : null,
      topic: args.topic ? args.topic : null,
      q: args.q && args.q.trim() ? args.q.trim() : null,
    },
  });
  return rows as unknown as EventCardData[];
}

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
  const navigate = useNavigate({ from: "/events/" });
  const { when, format, city: cityId, cityName, mine, kind, daypart, q, medium } = search;
  const topic = search.topic;
  const { user } = useAuth();

  const mineUpcomingFn = useServerFn(listMyUpcomingRsvps);
  const minePastFn = useServerFn(listMyPastRsvps);
  const publicEventsFn = useServerFn(listPublicEvents);
  const eventCitiesFn = useServerFn(listEventCities);
  const eventMediumsFn = useServerFn(listEventMediums);

  const mineActive = mine && !!user;

  const { data: publicData, isLoading: publicLoading } = useQuery({
    queryKey: ["public-events", when, format, cityId ?? null, kind, daypart, medium, q],
    queryFn: () =>
      fetchPublicEvents(publicEventsFn, when, format, cityId, kind, daypart, medium, q),
    staleTime: 60_000,
    enabled: !mineActive,
  });

  // City + medium option lists come from events that actually exist.
  const { data: cityRows } = useQuery({
    queryKey: ["events", "filter-cities", when],
    queryFn: () => eventCitiesFn({ data: { when } }),
    staleTime: 5 * 60_000,
  });
  const { data: mediumRows } = useQuery({
    queryKey: ["events", "filter-mediums"],
    queryFn: () => eventMediumsFn(),
    staleTime: 10 * 60_000,
  });
  const cityOptions: FilterCityOption[] = useMemo(
    () =>
      ((cityRows ?? []) as { id: string; name: string; count: number }[]).map((c) => ({
        value: c.id,
        label: c.name,
        count: c.count,
      })),
    [cityRows],
  );
  const mediumOptions = (mediumRows ?? []) as { slug: string; name: string; count: number }[];


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
  const rawList = events ?? [];
  const eventIds = useMemo(() => rawList.map((e) => e.id).sort(), [rawList]);
  const { data: eventTopicData } = useQuery({
    queryKey: ["events-topics", eventIds.join(",")],
    enabled: eventIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_event_topics")
        .select("event_id,topic:topics(slug,name)")
        .in("event_id", eventIds);
      if (error) throw error;
      const byEvent = new Map<string, string[]>();
      const names = new Map<string, string>();
      for (const row of (data ?? []) as unknown as {
        event_id: string;
        topic: { slug: string; name: string } | null;
      }[]) {
        if (!row.topic) continue;
        names.set(row.topic.slug, row.topic.name);
        const cur = byEvent.get(row.event_id);
        if (cur) cur.push(row.topic.slug);
        else byEvent.set(row.event_id, [row.topic.slug]);
      }
      return { byEvent, names };
    },
  });
  const topicOptions = useMemo(
    () =>
      Array.from(eventTopicData?.names.entries() ?? [])
        .map(([slug, name]) => ({ slug, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [eventTopicData],
  );
  const list = useMemo(() => {
    if (!topic) return rawList;
    return rawList.filter((e) => (eventTopicData?.byEvent.get(e.id) ?? []).includes(topic));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawList, topic, eventTopicData]);

  const happeningCount = useMemo(() => {
    const now = Date.now();
    return list.filter((e) => {
      const t = new Date(e.starts_at).getTime();
      return t <= now && t >= now - 1000 * 60 * 60 * 4;
    }).length;
  }, [list]);

  const mapPointsFn = useServerFn(listEventMapPoints);
  const { data: mapData } = useQuery({
    queryKey: ["events", "map-points", when, cityId ?? null],
    queryFn: () => mapPointsFn({ data: { when, cityId: cityId ?? null } }),
    staleTime: 5 * 60_000,
    enabled: !mineActive && format !== "online",
  });
  const mapVenues = (mapData?.venues ?? []) as unknown as MapVenuePoint[];
  const mapCities = (mapData?.cities ?? []) as unknown as MapCityPoint[];
  const mapCount = mapVenues.length + mapCities.length;

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
        url: `https://workshopindie.com${workshopEntityUrl({ kind: "event", groupSlug: e.group.slug, slug: e.slug })}`,
        name: e.title,
      })),
    };
  }, [list, when]);

  function setWhen(next: When) {
    navigate({ search: (prev: SearchShape): SearchShape => ({ ...prev, when: next }) });
  }
  function setFormat(next: Format) {
    navigate({
      search: (prev: SearchShape): SearchShape => ({
        ...prev,
        format: next,
        // Online ignores city.
        city: next === "online" ? undefined : prev.city,
        cityName: next === "online" ? undefined : prev.cityName,
      }),
    });
  }
  function setCity(next: { id: string; name: string } | null) {
    navigate({
      search: (prev: SearchShape): SearchShape => ({
        ...prev,
        city: next?.id,
        cityName: next?.name,
      }),
    });
  }
  function setCityId(nextId: string) {
    const match = cityOptions.find((c) => c.value === nextId);
    setCity(nextId && match ? { id: nextId, name: match.label } : null);
  }
  function setMine(next: boolean) {
    navigate({ search: (prev: SearchShape): SearchShape => ({ ...prev, mine: next }) });
  }
  function patch(next: Partial<SearchShape>) {
    navigate({ search: (prev: SearchShape): SearchShape => ({ ...prev, ...next }) });
  }

  const filtersActive =
    when !== "upcoming" ||
    format !== "all" ||
    !!cityId ||
    mine ||
    kind !== "all" ||
    daypart !== "all" ||
    !!medium ||
    !!topic ||
    !!q;

  const moreCount = (daypart !== "all" ? 1 : 0) + (mine ? 1 : 0) + (topic ? 1 : 0);

  const clearFilters = () =>
    navigate({
      search: () => ({
        when: "upcoming" as const,
        format: "all" as const,
        mine: false,
        kind: "all" as const,
        daypart: "all" as const,
        q: "",
        medium: "",
        topic: "",
      }),
      replace: true,
    });


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
            <Button asChild variant="outline" size="sm" className="rounded-md">
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
            Networking, listening parties, work-in-progress nights.
          </p>
          {list.length > 0 && (
            <span className="ml-auto rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] font-medium text-ink-soft">
              {list.length} {when}
            </span>
          )}
        </div>

        {/* Sticky filter header — one line: search + medium + city + when + format */}
        <FilterHeader inset className="mt-4">
          <FilterSearch
            value={q}
            onChange={(next) => patch({ q: next })}
            placeholder="Search events…"
            label="Search events"
          />
          <div className={FILTER_ROW_SCROLL}>
            <FilterToggleGroup
              value={when}
              onChange={setWhen}
              options={[
                { value: "upcoming" as const, label: "Upcoming" },
                { value: "past" as const, label: "Past" },
              ]}
            />

            {!mineActive && (
              <>
                <FilterSelect
                  label="Filter by medium"
                  value={medium}
                  onChange={(next) => patch({ medium: next })}
                  width="min-w-[11rem]"
                >
                  <option value="">All mediums</option>
                  {mediumOptions.map((m) => (
                    <option key={m.slug} value={m.slug}>
                      {m.name} ({m.count})
                    </option>
                  ))}
                </FilterSelect>

                <FilterCityPicker
                  value={format === "online" ? "" : (cityId ?? "")}
                  onChange={setCityId}
                  options={format === "online" ? [] : cityOptions}
                  allLabel="All cities"
                />

                <FilterToggleGroup
                  value={format}
                  onChange={setFormat}
                  options={[
                    { value: "all" as const, label: "All", icon: Calendar },
                    { value: "in_person" as const, label: "In person", icon: MapPin },
                    { value: "online" as const, label: "Online", icon: Radio },
                  ]}
                />
                <FilterPillToggle
                  active={kind === "coworking"}
                  onClick={() =>
                    patch({ kind: kind === "coworking" ? "all" : "coworking", daypart: "all" })
                  }
                >
                  Co-working
                </FilterPillToggle>
              </>
            )}

            <FilterMore activeCount={moreCount}>
              <div className="space-y-3">
                {topicOptions.length > 0 && (
                  <FilterMoreSection title="Topic">
                    <FilterSelect
                      label="Filter by topic"
                      width="w-full"
                      value={topic}
                      onChange={(next) => patch({ topic: next })}
                    >
                      <option value="">All topics</option>
                      {topicOptions.map((t) => (
                        <option key={t.slug} value={t.slug}>
                          {t.name}
                        </option>
                      ))}
                    </FilterSelect>
                  </FilterMoreSection>
                )}
                {user && (
                  <FilterMoreSection title="Yours">
                    <FilterMoreToggle active={mine} onClick={() => setMine(!mine)}>
                      My RSVPs
                    </FilterMoreToggle>
                  </FilterMoreSection>
                )}
                {!mineActive && (
                  <FilterMoreSection title="Time of day">
                    <div className="flex flex-wrap gap-1.5">
                      {(["all", "morning", "afternoon", "evening"] as const).map((d) => (
                        <FilterPillToggle
                          key={d}
                          active={daypart === d}
                          onClick={() => patch({ daypart: d })}
                          className="h-8 px-3 text-[12px]"
                        >
                          {d === "all" ? "Any time" : d.charAt(0).toUpperCase() + d.slice(1)}
                        </FilterPillToggle>
                      ))}
                    </div>
                  </FilterMoreSection>
                )}
              </div>
            </FilterMore>

            {filtersActive && <FilterClear onClick={clearFilters} />}
          </div>
        </FilterHeader>


        <div className="mt-3 space-y-1">
          {!mineActive &&
            defaultCity &&
            cityId === defaultCity.id &&
            defaultCity.source === "ip" && (
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
          <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-start">
            <FeaturedEventsCompact />
            {mapCount > 0 && (
              <div className="hidden lg:block">
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-soft">
                    On the map
                  </span>
                  <span className="text-[11px] text-ink-muted">
                    {mapVenues.length > 0
                      ? `${mapVenues.length} ${mapVenues.length === 1 ? "venue" : "venues"}`
                      : `${mapCities.length} ${mapCities.length === 1 ? "city" : "cities"}`}
                  </span>
                </div>
                <EventsMiniMap
                  venues={mapVenues}
                  cities={mapCities}
                  height={252}
                  onSelectCity={(c) => setCity({ id: c.id, name: c.name })}
                />
              </div>
            )}
          </section>
        )}

        <section className="mt-10">
          {isLoading && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-56 animate-pulse rounded-xl border border-border bg-muted/30"
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
                  : cityName
                    ? `No ${when} events in ${cityName} yet. Try Worldwide or a different city.`

                    : "Events hosted by the Groups you join will list here."
              }
              action={
                <Button asChild className="rounded-md" onClick={() => mineActive && setMine(false)}>
                  <Link
                    to={mineActive ? "/events" : "/groups"}
                    search={mineActive ? ({ mine: false } as never) : undefined}
                  >
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

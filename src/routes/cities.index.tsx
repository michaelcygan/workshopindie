import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeaderCompact } from "@/components/page-header-compact";
import { KickerChip } from "@/components/kicker-chip";
import { DottedRow } from "@/components/dotted-row";
import { EmptySpark } from "@/components/empty-spark";

export const Route = createFileRoute("/cities/")({
  component: CitiesIndex,
  head: () => ({
    meta: [
      { title: "Cities — Workshop" },
      { name: "description", content: "Find local Workshops, standing meetups, and creators in your city." },
      { property: "og:title", content: "Cities — Workshop" },
      { property: "og:description", content: "Find local Workshops, standing meetups, and creators in your city." },
      { property: "og:url", content: "https://workshopindie.com/cities" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://workshopindie.com/cities" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Cities — Workshop",
          description: "Find local Workshops, standing meetups, and creators in your city.",
          url: "https://workshopindie.com/cities",
          isPartOf: { "@type": "WebSite", name: "Workshop", url: "https://workshopindie.com" },
        }),
      },
    ],
  }),
});

type CityRow = {
  id: string; name: string; slug: string; country: string; state_region: string | null;
  meetups: { count: number }[] | null;
  creators: { count: number }[] | null;
};

function CitiesIndex() {
  const [query, setQuery] = useState("");
  const { data: cities = [], isLoading } = useQuery({
    queryKey: ["cities-with-counts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cities")
        .select("id,name,slug,country,state_region, meetups:standing_meetups(count), creators:profiles!profiles_city_id_fkey(count)")
        .order("name");
      return (data ?? []) as unknown as CityRow[];
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        (c.state_region ?? "").toLowerCase().includes(q),
    );
  }, [cities, query]);

  const featured = useMemo(
    () =>
      [...cities]
        .sort((a, b) => {
          const ax = (a.meetups?.[0]?.count ?? 0) + (a.creators?.[0]?.count ?? 0) * 0.1;
          const bx = (b.meetups?.[0]?.count ?? 0) + (b.creators?.[0]?.count ?? 0) * 0.1;
          return bx - ax;
        })
        .slice(0, 6),
    [cities],
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
      <PageHeaderCompact title="Cities" />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <KickerChip>Pick a city</KickerChip>
        <p className="text-sm text-ink-muted">
          Lounges, standing meetups, and the people making things nearby.
        </p>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Left: featured city callout */}
        <div className="rounded-3xl border border-border bg-surface p-6 shadow-soft">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-muted/70">
            Most active
          </div>
          <ul className="mt-3 flex flex-col gap-0.5">
            {featured.slice(0, 6).map((c) => {
              const meetups = c.meetups?.[0]?.count ?? 0;
              const creators = c.creators?.[0]?.count ?? 0;
              return (
                <li key={c.id}>
                  <Link to="/cities/$slug" params={{ slug: c.slug }} className="block">
                    <DottedRow
                      label={c.name}
                      live={meetups > 0}
                      count={creators}
                      meta={meetups > 0 ? `${meetups} meetup${meetups === 1 ? "" : "s"}` : null}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Right: searchable list */}
        <div className="flex min-h-0 flex-col rounded-3xl border border-border bg-surface shadow-soft">
          <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
            <Search className="h-4 w-4 text-ink-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cities"
              className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-muted/70 focus:outline-none"
            />
            <span className="text-[10.5px] font-semibold tabular-nums text-ink-muted/70">
              {filtered.length}
            </span>
          </div>
          <div className="scrollbar-none max-h-[480px] overflow-y-auto p-2">
            {isLoading ? (
              <div className="space-y-1.5 p-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-9 animate-pulse rounded-xl bg-surface-2" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptySpark
                title="No cities match."
                body="Try a different name, or add yours to your profile to seed the scene."
              />
            ) : (
              <ul className="flex flex-col gap-0.5">
                {filtered.map((c) => {
                  const meetups = c.meetups?.[0]?.count ?? 0;
                  const creators = c.creators?.[0]?.count ?? 0;
                  return (
                    <li key={c.id}>
                      <Link to="/cities/$slug" params={{ slug: c.slug }} className="block">
                        <DottedRow
                          label={
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin className="h-3 w-3 text-ink-muted/60" /> {c.name}
                            </span>
                          }
                          live={meetups > 0}
                          count={creators}
                          meta={c.state_region ?? c.country}
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

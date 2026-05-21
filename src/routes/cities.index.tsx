import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/cities/")({
  component: CitiesIndex,
  head: () => ({
    meta: [
      { title: "Cities — Workshop" },
      { name: "description", content: "Find local Workshops, standing meetups, and creators in your city." },
    ],
  }),
});

function CitiesIndex() {
  const { data: cities = [], isLoading } = useQuery({
    queryKey: ["cities-with-counts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cities")
        .select("id,name,slug,country,state_region, meetups:standing_meetups(count), creators:profiles(count)")
        .order("name");
      return data ?? [];
    },
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 md:px-6 md:py-14">
      <h1 className="font-display text-4xl text-ink md:text-5xl">Cities</h1>
      <p className="mt-1 text-ink-muted">Workshops, meetups, and creators in your area.</p>

      <div className="mt-8">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-2" />)}
          </div>
        ) : cities.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-surface p-12 text-center">
            <h3 className="font-display text-2xl text-ink">No cities yet.</h3>
            <p className="mt-1 text-sm text-ink-muted">Add a city to your profile to seed the local scene.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cities.map((c) => {
              const meetups = c.meetups?.[0]?.count ?? 0;
              const creators = c.creators?.[0]?.count ?? 0;
              return (
                <Link key={c.id} to="/cities/$slug" params={{ slug: c.slug }}
                  className="rounded-2xl border border-border bg-surface p-4 transition hover:shadow-lift">
                  <div className="flex items-center gap-2 text-ink">
                    <span className="gradient-motion inline-flex h-7 w-7 items-center justify-center rounded-full text-primary-foreground"><MapPin className="h-4 w-4" /></span>
                    <h3 className="font-display text-lg">{c.name}</h3>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">{c.state_region ? `${c.state_region}, ` : ""}{c.country}</p>
                  <p className="mt-2 text-xs text-ink-muted">{meetups} standing meetup{meetups === 1 ? "" : "s"} · {creators} creator{creators === 1 ? "" : "s"}</p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

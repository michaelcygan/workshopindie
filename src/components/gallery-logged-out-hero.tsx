import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

async function fetchLiveCounters() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ count: week }, { count: day }] = await Promise.all([
    supabase
      .from("works")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .gte("published_at", weekAgo),
    supabase
      .from("works")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .gte("published_at", dayAgo),
  ]);
  return { week: week ?? 0, day: day ?? 0 };
}

export function GalleryLoggedOutHero() {
  const { data } = useQuery({
    queryKey: ["gallery-live-counters"],
    queryFn: fetchLiveCounters,
    staleTime: 60_000,
  });
  const week = data?.week ?? 0;
  const day = data?.day ?? 0;
  return (
    <section className="border-b border-border bg-gradient-to-br from-surface to-background">
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-4 px-4 py-8 md:flex-row md:items-center md:justify-between md:px-6 md:py-10">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-ink-soft shadow-soft">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            {week > 0
              ? `${week.toLocaleString()} Works shipped this week · ${day} in the last 24h`
              : "Live creative network"}
          </div>
          <h2 className="font-display text-2xl text-ink md:text-3xl">
            Real Work, made by real people.
          </h2>
          <p className="mt-1 max-w-xl text-sm text-ink-muted">
            Follow the people you make things with. Vouch for what moves you. Ship your own.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link to="/login">
            <Button variant="outline" className="rounded-full">
              Sign in
            </Button>
          </Link>
          <Link to="/works/new">
            <Button className="rounded-full">Post to Gallery</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

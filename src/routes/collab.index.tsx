import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Megaphone, Search, X, MapPin } from "lucide-react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CollabCard, type CollabCardData } from "@/components/collab-card";
import { CategoryScroller } from "@/components/category-scroller";
import { WORK_CATEGORIES, type WorkCategory } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { useDefaultCity, useApplyDefaultCity } from "@/hooks/use-default-city";
import { GeoDefaultBanner } from "@/components/geo-default-banner";

const searchSchema = z.object({
  cat: fallback(z.enum(["all", "film", "music", "writing", "build", "visual"]), "all").default("all"),
  city: fallback(z.string().uuid().optional(), undefined),
  cityName: fallback(z.string().optional(), undefined),
  online: fallback(z.boolean(), false).default(false),
});

export const Route = createFileRoute("/collab/")({
  validateSearch: zodValidator(searchSchema),
  component: CollabPage,
  head: () => ({
    meta: [
      { title: "Collab Board — Workshop" },
      { name: "description", content: "Open calls for collaborators. Post your idea or jump on someone else's." },
    ],
  }),
});

type Filters = {
  cat: WorkCategory | "all";
  city?: string;
  online: boolean;
};

async function fetchPosts({ cat, city, online }: Filters) {
  let q = supabase
    .from("collab_posts")
    .select(
      "id,title,slug,category,description,timeline_text,timeline_mode,starts_on,ends_on,location_mode,compensation_type,status,created_at," +
        "user:profiles!collab_posts_user_id_fkey(display_name,username,avatar_url)," +
        "city:cities!collab_posts_city_id_fkey(name)," +
        "roles:collab_roles(id,role_name,sort_order)",
    )
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(60);

  if (cat !== "all") q = q.eq("category", cat);
  if (online) {
    q = q.eq("location_mode", "online");
  } else if (city) {
    // City selected: include posts in that city, posts open to that city, or online posts.
    q = q.or(`city_id.eq.${city},also_cities.cs.{${city}},location_mode.eq.online`);
  }

  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as unknown as CollabCardData[];

  // Light blended sort: newest first, gentle boost for posts with more roles.
  return rows
    .slice()
    .sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      const ra = (a.roles?.length ?? 0) * 1000 * 60 * 60 * 6; // each role ~ 6h "freshness"
      const rb = (b.roles?.length ?? 0) * 1000 * 60 * 60 * 6;
      return tb + rb - (ta + ra);
    });
}

function CityCombobox({
  value,
  valueLabel,
  onChange,
  disabled,
}: {
  value?: string;
  valueLabel?: string;
  onChange: (next: { id?: string; name?: string }) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const { data: cities } = useQuery({
    queryKey: ["collab-city-search", query],
    queryFn: async () => {
      const base = supabase.from("cities").select("id,name,country").order("name").limit(8);
      const { data } = query.trim()
        ? await base.ilike("name", `%${query.trim()}%`)
        : await base;
      return data ?? [];
    },
    enabled: open && !disabled,
    staleTime: 30_000,
  });

  return (
    <div ref={wrapRef} className={cn("relative flex-1 min-w-0", disabled && "opacity-50")}>
      <div
        className={cn(
          "flex h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 shadow-soft transition focus-within:shadow-lift",
          disabled && "pointer-events-none",
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-ink-muted" />
        {value ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex flex-1 items-center gap-1.5 truncate text-left text-sm text-ink"
          >
            <MapPin className="h-3.5 w-3.5 text-ink-soft" />
            <span className="truncate">{valueLabel ?? "Selected city"}</span>
          </button>
        ) : (
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Search by city — or leave for anywhere"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-muted/70 focus:outline-none"
            disabled={disabled}
          />
        )}
        {(value || query) && !disabled && (
          <button
            type="button"
            onClick={() => { onChange({ id: undefined, name: undefined }); setQuery(""); setOpen(false); }}
            className="rounded-full p-1 text-ink-muted hover:bg-muted hover:text-ink"
            aria-label="Clear city"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && !disabled && !value && (
        <div className="absolute left-0 right-0 z-20 mt-2 max-h-72 overflow-auto rounded-2xl border border-border bg-surface p-1 shadow-lift">
          {(cities ?? []).length === 0 ? (
            <div className="px-3 py-2 text-sm text-ink-muted">No cities match.</div>
          ) : (
            (cities ?? []).map((c: { id: string; name: string; country: string }) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { onChange({ id: c.id, name: c.name }); setOpen(false); setQuery(""); }}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-ink hover:bg-muted"
              >
                <span className="truncate">{c.name}</span>
                <span className="ml-3 shrink-0 text-xs text-ink-muted">{c.country}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function CollabPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/collab" });

  const filters: Filters = useMemo(
    () => ({ cat: search.cat, city: search.city, online: search.online }),
    [search.cat, search.city, search.online],
  );

  const { data: posts, isLoading } = useQuery({
    queryKey: ["collab", filters],
    queryFn: () => fetchPosts(filters),
  });

  const tabs = useMemo(
    () => [
      { id: "all" as const, label: "All" },
      ...WORK_CATEGORIES.map((c) => ({ id: c.id as WorkCategory, label: c.label })),
    ],
    [],
  );

  type SearchShape = { cat: WorkCategory | "all"; city?: string; cityName?: string; online: boolean };
  function setCat(next: WorkCategory | "all") {
    navigate({ search: (prev: SearchShape) => ({ ...prev, cat: next }) });
  }
  function setCity(next: { id?: string; name?: string }) {
    navigate({ search: (prev: SearchShape) => ({ ...prev, city: next.id, cityName: next.name }) });
  }
  function toggleOnline() {
    navigate({
      search: (prev: SearchShape) => ({
        ...prev,
        online: !prev.online,
        // If switching ON, clear city since it's irrelevant for online-only.
        city: !prev.online ? undefined : prev.city,
        cityName: !prev.online ? undefined : prev.cityName,
      }),
    });
  }

  const defaultCityQuery = useDefaultCity();
  const defaultCity = defaultCityQuery.data?.city ?? null;
  useApplyDefaultCity({
    feedKey: "collab",
    isWorldwide: !filters.city && !filters.online,
    apply: (city) => setCity({ id: city.id, name: city.name }),
    defaultCity,
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end"
      >
        <div>
          <h1 className="font-display text-4xl text-ink md:text-5xl">Collab Board</h1>
          <p className="mt-1 text-ink-muted">Projects looking for people. Find one. Pitch yourself.</p>
        </div>
        <Link to="/collab/new">
          <Button className="rounded-full gap-2">
            <Megaphone className="h-4 w-4" /> Post a call
          </Button>
        </Link>
      </motion.div>

      {/* Category scroller — one line, infinite on mobile */}
      <div className="mt-8">
        <CategoryScroller tabs={tabs} value={filters.cat} onChange={setCat} />
      </div>

      {/* Location filter row — city search + online-only chip */}
      <div className="mt-3 flex items-center gap-2">
        <CityCombobox
          value={filters.city}
          valueLabel={search.cityName}
          onChange={setCity}
          disabled={filters.online}
        />
        <button
          type="button"
          onClick={toggleOnline}
          className={cn(
            "h-11 shrink-0 rounded-full border px-4 text-sm font-medium transition shadow-soft",
            filters.online
              ? "border-transparent bg-ink text-background"
              : "border-border bg-surface text-ink-soft hover:bg-muted",
          )}
          aria-pressed={filters.online}
        >
          Online only
        </button>
      </div>

      <div className="mt-3">
        <GeoDefaultBanner
          defaultCity={defaultCity}
          isOnDefault={!!defaultCity && filters.city === defaultCity.id}
          isWorldwide={!filters.city && !filters.online}
          onApply={(city) => setCity({ id: city.id, name: city.name })}
          onWorldwide={() => setCity({ id: undefined, name: undefined })}
        />
      </div>


      <div className="mt-8">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-56 animate-pulse rounded-3xl bg-surface-2" />
            ))}
          </div>
        ) : !posts || posts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-surface p-12 text-center">
            <h3 className="font-display text-2xl text-ink">Nothing open right now.</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
              Be the first to post — list the roles, the people show up.
            </p>
            <Link to="/collab/new" className="mt-5 inline-block">
              <Button className="rounded-full">Post a call</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {posts.map((p) => <CollabCard key={p.id} post={p} />)}
          </div>
        )}
      </div>
    </main>
  );
}

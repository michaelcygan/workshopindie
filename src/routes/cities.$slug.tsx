import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { MapPin, Megaphone, Plus, Sparkles, Pin, PinOff, Radio, CalendarClock, Globe2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-role";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CreatorBadge } from "@/components/creator-badge";
import { WorkCard, type WorkCardData } from "@/components/work-card";
import { CollabCard, type CollabCardData } from "@/components/collab-card";
import { WorkshopCard, type WorkshopCardData } from "@/components/workshop-card";
import { CategoryScroller } from "@/components/category-scroller";
import { PostWorkshopFromCitySheet } from "@/components/post-workshop-from-city-sheet";
import { WORK_CATEGORIES, type Category } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { useDocumentMeta } from "@/lib/seo";
import { toast } from "sonner";

export const Route = createFileRoute("/cities/$slug")({
  component: CityPage,
  loader: async ({ params }) => {
    const { getCitySeo } = await import("@/lib/seo-loaders.functions");
    const data = await getCitySeo({ data: { slug: params.slug } });
    return { seo: data };
  },
  errorComponent: ({ error, reset }) => (
    <main className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl text-ink">Couldn't load this city</h1>
      <p className="mt-2 text-sm text-ink-muted">{error.message}</p>
      <button onClick={reset} className="mt-6 rounded-full border border-border px-4 py-2 text-sm hover:bg-surface">Try again</button>
    </main>
  ),
  notFoundComponent: () => (
    <main className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl text-ink">City not found</h1>
      <p className="mt-2 text-ink-muted">No city matches that name yet.</p>
      <Link to="/cities" className="mt-6 inline-block rounded-full border border-border px-4 py-2 text-sm hover:bg-surface">Browse Cities</Link>
    </main>
  ),
  head: ({ params, loaderData }) => {
    const c = loaderData?.seo;
    const url = `https://workshopindie.com/cities/${params.slug}`;
    const name = c?.name ?? params.slug;
    const title = `${name} — Workshop`;
    const description = c
      ? `Live and scheduled Workshops, open collabs, and creators in ${c.name}${c.country ? `, ${c.country}` : ""}.`
      : "Creators on Workshop.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
});

type WorkshopRow = WorkshopCardData & {
  mode: "scheduled" | "instant_spawned" | string;
  is_pinned: boolean;
  city_id: string | null;
};
type WorkshopTab = "all" | "live" | "scheduled" | "standing";

function CityPage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const { isAdmin } = useUserRoles();
  const qc = useQueryClient();
  const [postWorkshopOpen, setPostWorkshopOpen] = useState(false);
  const [creatorFilter, setCreatorFilter] = useState<Category | "all">("all");
  const [wsTab, setWsTab] = useState<WorkshopTab>("all");

  const { data: city, isLoading } = useQuery({
    queryKey: ["city", slug],
    queryFn: async () => {
      const { data } = await supabase.from("cities").select("id,name,country,state_region,slug").eq("slug", slug).maybeSingle();
      return data;
    },
  });

  useDocumentMeta({
    title: city?.name,
    description: city ? `Live and scheduled Workshops, open collabs, and creators in ${city.name}.` : undefined,
  });

  const { data: workshops = [] } = useQuery({
    queryKey: ["city-workshops", city?.id],
    enabled: !!city?.id,
    queryFn: async () => {
      const { data } = await supabase.from("workshops")
        .select("id,title,slug,category,prompt,starts_at,location_type,location_text,participant_cap,confirmed_count,application_count,status,mode,is_pinned,city_id,audience_city_ids, host:profiles!workshops_host_user_id_fkey(display_name,username,avatar_url)")
        .or(`city_id.eq.${city!.id},audience_city_ids.cs.{${city!.id}}`)
        .eq("visibility", "public")
        .not("status", "in", "(archived,canceled)")
        .order("starts_at", { ascending: true, nullsFirst: false })
        .limit(48);
      return (data ?? []) as unknown as WorkshopRow[];
    },
  });

  const filteredWorkshops = useMemo(() => {
    const now = Date.now();
    const live = workshops.filter((w) => w.status === "active" || w.status === "check_in");
    const standing = workshops.filter((w) => w.is_pinned);
    const scheduled = workshops.filter((w) =>
      w.mode === "scheduled" && (w.status === "open" || w.status === "check_in") &&
      w.starts_at && new Date(w.starts_at).getTime() >= now - 60 * 60 * 1000
    );

    if (wsTab === "live") return live;
    if (wsTab === "scheduled") return scheduled;
    if (wsTab === "standing") return standing;
    // All: live first, then standing not already shown, then upcoming scheduled
    const seen = new Set<string>();
    const out: WorkshopRow[] = [];
    for (const w of live) { if (!seen.has(w.id)) { seen.add(w.id); out.push(w); } }
    for (const w of standing) { if (!seen.has(w.id)) { seen.add(w.id); out.push(w); } }
    for (const w of scheduled) { if (!seen.has(w.id)) { seen.add(w.id); out.push(w); } }
    return out;
  }, [workshops, wsTab]);

  const { data: works = [] } = useQuery({
    queryKey: ["city-works", city?.id],
    enabled: !!city?.id,
    queryFn: async () => {
      const { data } = await supabase.from("works")
        .select("id,title,slug,category,cover_url,source_type,like_count,save_count,view_count,published_at, work_credits(role_label,sort_order, profiles(id,display_name,username))")
        .eq("city_id", city!.id).eq("status", "published").in("visibility", ["public", "unlisted"])
        .order("published_at", { ascending: false, nullsFirst: false }).limit(6);
      type Row = {
        id: string; title: string; slug: string; category: WorkCardData["category"];
        cover_url: string | null; source_type: WorkCardData["source_type"];
        like_count: number | null; save_count: number | null; view_count: number | null;
        work_credits: Array<{
          role_label: string | null; sort_order: number | null;
          profiles: { id: string; display_name: string | null; username: string | null } | null;
        }> | null;
      };
      return ((data ?? []) as Row[]).map<WorkCardData>((r) => ({
        id: r.id, title: r.title, slug: r.slug, category: r.category, cover_url: r.cover_url, source_type: r.source_type,
        like_count: r.like_count ?? 0, save_count: r.save_count ?? 0, view_count: r.view_count ?? 0,
        credits: (r.work_credits ?? []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((c) => ({ id: c.profiles?.id ?? null, display_name: c.profiles?.display_name ?? null, username: c.profiles?.username ?? null })),
      }));
    },
  });

  const { data: collabs = [] } = useQuery({
    queryKey: ["city-collabs", city?.id],
    enabled: !!city?.id,
    queryFn: async () => {
      const { data } = await supabase.from("collab_posts")
        .select("id,title,slug,category,description,timeline_text,timeline_mode,starts_on,ends_on,location_mode,compensation_type,status,created_at, user:profiles!collab_posts_user_id_fkey(display_name,username,avatar_url), city:cities!collab_posts_city_id_fkey(name), roles:collab_roles(id,role_name,sort_order)")
        .or(`city_id.eq.${city!.id},also_cities.cs.{${city!.id}}`)
        .eq("status", "open")
        .order("created_at", { ascending: false }).limit(6);
      return (data ?? []) as unknown as CollabCardData[];
    },
  });

  const { data: creators = [] } = useQuery({
    queryKey: ["city-creators", city?.id],
    enabled: !!city?.id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles")
        .select("id,username,display_name,avatar_url,headline,creator_status,work_count,categories")
        .eq("city_id", city!.id).eq("discoverable", true).order("work_count", { ascending: false }).limit(48);
      return data ?? [];
    },
  });

  const filteredCreators = useMemo(() => {
    if (creatorFilter === "all") return creators;
    return creators.filter((p) => Array.isArray(p.categories) && p.categories.includes(creatorFilter));
  }, [creators, creatorFilter]);

  const creatorTabs = useMemo(
    () => [{ id: "all" as const, label: "All" }, ...WORK_CATEGORIES.map((c) => ({ id: c.id, label: c.label }))],
    []
  );

  const workshopTabs = useMemo(
    () => [
      { id: "all" as const, label: "All" },
      { id: "live" as const, label: "Live" },
      { id: "scheduled" as const, label: "Scheduled" },
      { id: "standing" as const, label: "Standing" },
    ],
    []
  );

  async function togglePin(ws: WorkshopRow) {
    const { error } = await supabase.from("workshops")
      .update({ is_pinned: !ws.is_pinned })
      .eq("id", ws.id);
    if (error) return toast.error(error.message);
    toast.success(ws.is_pinned ? "Unpinned" : "Pinned as standing Workshop");
    qc.invalidateQueries({ queryKey: ["city-workshops", city?.id] });
  }

  if (isLoading) return <main className="mx-auto max-w-5xl px-4 py-14"><div className="h-32 animate-pulse rounded-3xl bg-surface-2" /></main>;
  if (!city) return (
    <main className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl text-ink">City not found</h1>
      <Link to="/cities" className="mt-4 inline-block text-gradient-motion underline">Back to cities</Link>
    </main>
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
      <Link to="/cities" className="text-sm text-ink-muted hover:text-ink">← All cities</Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-ink md:text-5xl inline-flex items-center gap-2">
            <span className="gradient-motion inline-flex h-11 w-11 items-center justify-center rounded-full text-primary-foreground"><MapPin className="h-6 w-6" /></span> {city.name}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">{city.state_region ? `${city.state_region}, ` : ""}{city.country}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" className="rounded-full gap-1.5">
            <Link to="/collab/new">
              <Megaphone className="h-4 w-4" /> Post a Collab
            </Link>
          </Button>
          <Button
            className="rounded-full gap-1.5"
            onClick={() => user ? setPostWorkshopOpen(true) : toast.error("Sign in to post a Workshop")}
          >
            <Plus className="h-4 w-4" /> Post a Workshop
          </Button>
        </div>
      </div>

      <PostWorkshopFromCitySheet
        open={postWorkshopOpen}
        onOpenChange={setPostWorkshopOpen}
        city={city}
        isAdmin={isAdmin}
        onPosted={() => qc.invalidateQueries({ queryKey: ["city-workshops", city.id] })}
      />

      {/* Open to collaborate — hero block */}
      <section className="mt-10">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl text-ink inline-flex items-center gap-2">
              <span className="gradient-motion inline-flex h-7 w-7 items-center justify-center rounded-full text-primary-foreground"><Sparkles className="h-4 w-4" /></span> Open to collaborate
            </h2>
            <p className="mt-1 text-sm text-ink-muted">Live calls from people who want to make something in {city.name}.</p>
          </div>
          {collabs.length > 0 && (
            <Link to="/collab" className="text-sm text-ink-muted hover:text-ink">See all →</Link>
          )}
        </div>
        {collabs.length === 0 ? (
          <div className="mt-3 rounded-3xl border border-dashed border-border bg-surface p-8 text-center">
            <p className="text-sm text-ink-muted">No open calls in {city.name} yet — be the first to start something.</p>
            <Button asChild className="mt-4 rounded-full gap-1.5">
              <Link to="/collab/new"><Megaphone className="h-4 w-4" /> Post the first collab here</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {collabs.map((c) => <CollabCard key={c.id} post={c} />)}
          </div>
        )}
      </section>

      {/* Workshops */}
      <section className="mt-12">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-display text-2xl text-ink">Workshops in {city.name}</h2>
            <p className="mt-1 text-sm text-ink-muted">Live now, scheduled, and standing. City-only audience.</p>
          </div>
          <CategoryScroller tabs={workshopTabs} value={wsTab} onChange={(v) => setWsTab(v)} className="md:w-fit" />
        </div>

        {filteredWorkshops.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
            <p className="text-sm text-ink-muted">
              {wsTab === "live" && `No live Workshops in ${city.name} right now.`}
              {wsTab === "scheduled" && `Nothing on the calendar yet.`}
              {wsTab === "standing" && `No standing Workshops here yet.`}
              {wsTab === "all" && `No Workshops in ${city.name} yet — start one.`}
            </p>
            <Button className="mt-4 rounded-full gap-1.5" onClick={() => user ? setPostWorkshopOpen(true) : toast.error("Sign in to post a Workshop")}>
              <Plus className="h-4 w-4" /> Post a Workshop
            </Button>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredWorkshops.map((w) => (
              <div key={w.id} className="relative">
                {/* Status delineation pills */}
                <div className="pointer-events-none absolute left-3 top-3 z-20 flex flex-wrap gap-1">
                  {(w.status === "active" || w.status === "check_in") && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/95 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow">
                      <Radio className="h-2.5 w-2.5" /> Live
                    </span>
                  )}
                  {w.mode === "scheduled" && w.status === "open" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-background/95 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink shadow">
                      <CalendarClock className="h-2.5 w-2.5" /> Scheduled
                    </span>
                  )}
                  {w.is_pinned && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/95 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow">
                      <Pin className="h-2.5 w-2.5" /> Standing
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-full bg-background/95 px-2 py-0.5 text-[10px] font-medium text-ink-soft shadow">
                    {w.location_type === "online"
                      ? <><Globe2 className="h-2.5 w-2.5" /> Online</>
                      : <><MapPin className="h-2.5 w-2.5" /> IRL</>}
                  </span>
                </div>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => togglePin(w)}
                    title={w.is_pinned ? "Unpin" : "Pin as standing"}
                    className="absolute right-3 top-3 z-20 inline-flex h-7 w-7 items-center justify-center rounded-full bg-background/95 text-ink-soft shadow hover:text-ink"
                  >
                    {w.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                  </button>
                )}

                <WorkshopCard ws={w} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recently made here */}
      {works.length > 0 && (
        <section className="mt-12">
          <div className="flex items-end justify-between gap-3">
            <h2 className="font-display text-2xl text-ink">Recently made here</h2>
            <Link to="/gallery" search={{ city: city.slug }} className="text-sm text-ink-muted hover:text-ink">See all in {city.name} →</Link>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {works.map((w) => <WorkCard key={w.id} work={w} />)}
          </div>
        </section>
      )}

      {/* Creators */}
      {creators.length > 0 && (
        <section className="mt-12 pb-16">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <h2 className="font-display text-2xl text-ink">Local creators</h2>
            <CategoryScroller
              tabs={creatorTabs}
              value={creatorFilter}
              onChange={(v) => setCreatorFilter(v)}
              className="md:w-fit"
            />
          </div>
          {filteredCreators.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted">No creators here working in this medium yet.</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCreators.map((p: any) => {
                const parts = String(p.display_name || "").trim().split(/\s+/).filter(Boolean);
                const first = parts[0] || p.username || "Anon";
                const lastInitial = parts.length > 1 ? parts[parts.length - 1][0].toUpperCase() : "";
                const displayName = lastInitial ? `${first} ${lastInitial}.` : first;
                const initials = (parts[0]?.[0] || p.username?.[0] || "·").toUpperCase() + (lastInitial || "");
                const inner = (
                  <>
                    <Avatar className="h-10 w-10"><AvatarImage src={p.avatar_url ?? undefined} /><AvatarFallback>{initials}</AvatarFallback></Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="truncate font-medium text-ink">{displayName}</h3>
                        <CreatorBadge status={p.creator_status} />
                      </div>
                      {p.username ? (
                        <p className="truncate text-xs text-ink-muted">@{p.username}{p.headline ? ` · ${p.headline}` : ""}</p>
                      ) : p.headline ? (
                        <p className="truncate text-xs text-ink-muted">{p.headline}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs text-ink-muted">{p.work_count} work{p.work_count === 1 ? "" : "s"}</span>
                  </>
                );
                const base = "flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition";
                if (p.username) {
                  return (
                    <Link key={p.id} to="/u/$username" params={{ username: p.username }}
                      className={cn(base, "hover:shadow-soft hover:bg-muted/40")}>
                      {inner}
                    </Link>
                  );
                }
                return <div key={p.id} className={base}>{inner}</div>;
              })}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

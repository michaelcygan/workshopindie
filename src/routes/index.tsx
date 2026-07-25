import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Megaphone, Radio, Sparkles, MapPin, ArrowRight, Calendar, Users, Compass, Hammer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { type WorkCardData } from "@/components/work-card";
import { type CollabCardData } from "@/components/collab-card";
import { WORK_CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/categories";
import { getNetworkFeed } from "@/lib/network.functions";
import { useBlockedIds } from "@/hooks/use-blocked-ids";
import { cn } from "@/lib/utils";
import { EtherealBackground } from "@/components/ethereal-background";
import { WorldArcs } from "@/components/world-arcs";
import { useGlobePromos } from "@/lib/globe-promos";
import { YourGroupsStrip } from "@/components/your-groups-strip";
import { HomeLiveWorkshopsRail } from "@/components/home-live-workshops-rail";
import { HomePulseRail } from "@/components/home-pulse-rail";
import { FeaturedEventsCarousel } from "@/components/featured-events-carousel";
import { UpcomingInMyGroupsRail } from "@/components/upcoming-in-my-groups-rail";
import { HomeBlogRail } from "@/components/home-blog-rail";
import { useMyGroupIdSet } from "@/hooks/use-my-groups";
import { useGroupTagsFor, rerankByMyGroups } from "@/hooks/use-group-tags";
import { GalleryLoggedOutHero } from "@/components/gallery-logged-out-hero";
import { HomeSection, HomeSectionHeader } from "@/components/home-section";
import { EditorialCard, EditorialChip } from "@/components/editorial-card";


export const Route = createFileRoute("/")({ component: Index });

type SortKey = "newest" | "trending";

async function fetchWorks(category: Category | "all", sort: SortKey, blockedIds: string[]) {
  let q = supabase
    .from("works")
    .select("id,title,slug,category,categories,cover_url,embed_url,source_type,like_count,save_count,view_count,published_at,popularity_score,created_at,created_by, work_credits(role_label, sort_order, display_name, profiles(id,display_name, username))")
    .eq("status", "published")
    .in("visibility", ["public", "unlisted"])
    .limit(12);

  if (category !== "all") q = q.contains("categories", [category]);
  if (sort === "newest") q = q.order("published_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
  else q = q.order("popularity_score", { ascending: false }).order("like_count", { ascending: false });

  const { data, error } = await q;
  if (error) throw error;
  type Row = {
    id: string; title: string; slug: string; category: Category;
    cover_url: string | null; embed_url: string | null; source_type: string;
    like_count: number; save_count: number; view_count: number;
    created_by: string;
    work_credits?: { sort_order: number; display_name: string | null; profiles: { id: string; display_name: string | null; username: string | null } | null }[];
  };
  const blocked = new Set(blockedIds);
  return (data as Row[])
    .filter((r) => !blocked.has(r.created_by))
    .map<WorkCardData>((r) => ({
      id: r.id, title: r.title, slug: r.slug, category: r.category,
      cover_url: r.cover_url, embed_url: r.embed_url, source_type: r.source_type,
      like_count: r.like_count, save_count: r.save_count, view_count: r.view_count,
      credits: (r.work_credits ?? [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((c) => ({ id: c.profiles?.id ?? null, display_name: c.profiles?.display_name ?? c.display_name ?? null, username: c.profiles?.username ?? null })),
    }));
}

function Hero() {
  const { data: globePromos } = useGlobePromos();
  return (
    <section className="relative isolate overflow-hidden border-b border-border min-h-[88vh] flex items-center">
      {/* Ambient ethereal background */}
      <EtherealBackground className="absolute inset-0 -z-20" />
      {/* Warm cream veil for type contrast */}
      <div className="absolute inset-0 -z-10 bg-background/70" />
      <div className="absolute inset-0 -z-10 gradient-soft opacity-60" />
      {/* Animated globe of creative collaborations */}
      <div className="absolute inset-0 -z-[5] flex items-end justify-center overflow-hidden md:items-center">
        <WorldArcs
          className="relative h-[72vh] min-h-[520px] w-full opacity-90 md:h-[100vh] md:min-h-[760px] md:w-[118vw] md:max-w-[1600px]"
          promos={globePromos}
        />
      </div>
      <div className="absolute inset-0 -z-[4] bg-gradient-to-b from-background/30 via-transparent to-background/50" />

      <div className="relative mx-auto w-full max-w-6xl px-4 py-10 md:px-6 md:py-14 text-center pb-[calc(env(safe-area-inset-bottom)+112px)] md:pb-14">
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/90 backdrop-blur px-3 py-1 text-xs text-ink-soft shadow-soft"
        >
          <span className="gradient-motion inline-flex h-5 w-5 items-center justify-center rounded-full text-primary-foreground"><Sparkles className="h-3 w-3" /></span> A creative collaboration network
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.05 }}
          className="font-display mt-4 text-4xl leading-[1.15] tracking-tight text-ink sm:text-5xl md:text-6xl lg:text-7xl pb-2"
        >
          Build your network. <span className="italic text-gradient-motion inline-block pr-1 pb-1">Create together.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
          className="mx-auto mt-4 max-w-xl text-base text-ink-soft md:text-lg"
        >
          Drop into the Lounge with other artists and creators. Post a Collab, join a Group, and find an event near you.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.18 }}
          className="mx-auto mt-6 grid max-w-4xl gap-4 md:grid-cols-3"
        >
          <Link
            to="/lounge"
            className="gradient-motion group relative flex min-h-[180px] flex-col items-start gap-3 rounded-3xl p-6 text-left text-primary-foreground shadow-lift transition md:hover:-translate-y-0.5 md:hover:shadow-xl md:p-7"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary-foreground/15">
              <Radio className="h-5 w-5" />
            </span>
            <div>
              <div className="font-display text-xl md:text-2xl leading-tight">Drop into the Lounge</div>
              <p className="mt-2 text-sm text-primary-foreground/85">
                Live, drop-in rooms with shared tools. Jam, critique, hack, or just work alongside other people.
              </p>
            </div>
            <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium opacity-90 transition group-hover:gap-2">
              Drop in <ArrowRight className="h-4 w-4" />
            </span>
          </Link>

          <Link
            to="/collab/new"
            className="group relative flex min-h-[180px] flex-col items-start gap-3 rounded-3xl border border-border bg-surface/95 backdrop-blur p-6 text-left text-ink shadow-soft transition md:hover:-translate-y-0.5 md:hover:shadow-lift md:p-7"
          >
            <span className="gradient-motion inline-flex h-10 w-10 items-center justify-center rounded-full text-primary-foreground">
              <Megaphone className="h-5 w-5" />
            </span>
            <div>
              <div className="font-display text-xl md:text-2xl leading-tight">Post a Collab</div>
              <p className="mt-2 text-sm text-ink-muted">
                Describe what you're making and accept applications. Publish the thing, credit the cast, keep the receipts.
              </p>
            </div>
            <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-gradient-motion transition group-hover:gap-2">
              Post a Collab <ArrowRight className="h-4 w-4" />
            </span>
          </Link>

          <Link
            to="/events"
            className="group relative flex min-h-[180px] flex-col items-start gap-3 rounded-3xl border border-border bg-surface/95 backdrop-blur p-6 text-left text-ink shadow-soft transition md:hover:-translate-y-0.5 md:hover:shadow-lift md:p-7"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Calendar className="h-5 w-5" />
            </span>
            <div>
              <div className="font-display text-xl md:text-2xl leading-tight">Find an Event</div>
              <p className="mt-2 text-sm text-ink-muted">
                Workshops, open mics, listening parties, networking — in person and online. Build your creative network and get to work.
              </p>
            </div>
            <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-gradient-motion transition group-hover:gap-2">
              Find events <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

function GalleryControls({
  category, setCategory, sort, setSort,
}: { category: Category | "all"; setCategory: (c: Category | "all") => void; sort: SortKey; setSort: (s: SortKey) => void }) {
  const tabs: { id: Category | "all"; label: string }[] = [
    { id: "all", label: "All" },
    ...WORK_CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
  ];
  return (
    <div className="flex flex-col-reverse items-start justify-between gap-3 md:flex-row md:items-center">
      <div className="-mx-4 flex w-full gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:w-auto md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setCategory(t.id)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-sm transition",
              category === t.id
                ? "bg-ink text-background"
                : "border border-border bg-surface text-ink-soft hover:bg-muted",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex shrink-0 gap-1 rounded-full border border-border bg-surface p-1 shadow-soft">
        {(["newest", "trending"] as SortKey[]).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm capitalize transition",
              sort === s ? "bg-ink text-background" : "text-ink-soft hover:bg-muted",
            )}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function Index() {
  const { user } = useAuth();

  return (
    <main>
      <Hero />

      {/* ─── Live pulse: ambient one-line ticker ─── */}
      <HomePulseRail compact />

      {/* ─── ACT 1: Happening now ─── */}
      <HomeLiveWorkshopsRail />

      {!user && (
        <section className="mx-auto max-w-7xl px-4 pt-4 md:px-6">
          <GalleryLoggedOutHero />
        </section>
      )}

      {user && (
        <section className="mx-auto max-w-7xl px-4 pt-4 md:px-6">
          <YourGroupsStrip />
        </section>
      )}

      {user && <NetworkRail />}

      {/* ─── ACT 2: What people are making ─── */}
      <CollabsRail />

      <GalleryRail />

      {/* ─── ACT 3: Where to show up ─── */}
      <section className="mx-auto max-w-7xl border-t border-border/60 px-4 py-12 md:px-6 md:py-16">
        <FeaturedEventsCarousel />
      </section>

      <section className="mx-auto max-w-7xl border-t border-border/60 px-4 py-12 md:px-6 md:py-16">
        <UpcomingInMyGroupsRail />
      </section>

      <CityMeetupsStrip />

      {/* ─── Blog closer ─── */}
      <section className="mx-auto max-w-7xl border-t border-border/60 px-4 py-12 md:px-6 md:py-16">
        <HomeBlogRail />
      </section>
    </main>
  );
}

function GalleryRail() {
  const [category, setCategory] = useState<Category | "all">("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const { ids: blockedIds } = useBlockedIds();
  const blockedKey = useMemo(() => Array.from(blockedIds).sort().join(","), [blockedIds]);
  const { data: rawWorks, isLoading } = useQuery({
    queryKey: ["works", category, sort, blockedKey],
    queryFn: () => fetchWorks(category, sort, Array.from(blockedIds)),
  });
  const workIds = useMemo(() => (rawWorks ?? []).map((w) => w.id), [rawWorks]);
  const { data: groupTagMap } = useGroupTagsFor("work", workIds);
  const myGroupIds = useMyGroupIdSet();
  const worksAll = useMemo(
    () => rerankByMyGroups(rawWorks ?? [], groupTagMap, myGroupIds),
    [rawWorks, groupTagMap, myGroupIds],
  );
  const works = worksAll.slice(0, 3);

  return (
    <HomeSection
      eyebrow={<><Hammer className="h-3.5 w-3.5" /> Gallery</>}
      title="Finished things people made together."
      kicker="A curated look at what the network has been shipping lately."
      href="/gallery"
      cta="Browse all"
    >
      <div className="mb-6">
        <GalleryControls category={category} setCategory={setCategory} sort={sort} setSort={setSort} />
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="aspect-[16/10] animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </div>
      ) : !works || works.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-surface p-12 text-center">
          <h3 className="font-display text-2xl text-ink">Nothing here yet — post your work.</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
            Be the first to post your work and start your portfolio.
          </p>
          <Link to="/works/new" className="mt-5 inline-block">
            <Button className="rounded-full">Post to Gallery</Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {works.map((w) => {
              const credit = w.credits?.[0];
              const author = credit?.display_name || credit?.username || null;
              const extra = (w.credits?.length ?? 0) - 1;
              return (
                <EditorialCard
                  key={w.id}
                  cover={w.cover_url}
                  aspect="16/10"
                  eyebrow={
                    <>
                      {CATEGORY_LABELS[w.category] ?? w.category}
                      {author ? <> · by {author}{extra > 0 ? ` +${extra}` : ""}</> : null}
                    </>
                  }
                  title={w.title}
                  chips={
                    <>
                      {w.like_count > 0 && (
                        <EditorialChip>{w.like_count} likes</EditorialChip>
                      )}
                      {w.view_count > 0 && (
                        <EditorialChip>{w.view_count} views</EditorialChip>
                      )}
                    </>
                  }
                  href="/works/$slug"
                  hrefParams={{ slug: w.slug }}
                  ariaLabel={w.title}
                />
              );
            })}
          </div>
          <div className="mt-10 flex justify-center">
            <Link
              to="/gallery"
              search={{ q: "", tab: "for-you", cat: category, src: "all", sort: sort === "newest" ? "recent" : "trending" }}
              className="group inline-flex items-center gap-1 rounded-full border border-border bg-surface px-4 py-2 text-sm text-ink-soft transition hover:bg-muted hover:text-ink"
            >
              Browse the full Gallery
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </>
      )}
    </HomeSection>
  );
}

function CollabsRail() {
  const { ids: blockedIds } = useBlockedIds();
  const blockedKey = useMemo(() => Array.from(blockedIds).sort().join(","), [blockedIds]);
  const { data: rawPosts, isLoading } = useQuery({
    queryKey: ["home-open-collabs", blockedKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collab_posts")
        .select(
          "id,user_id,title,slug,category,description,timeline_text,timeline_mode,starts_on,ends_on,location_mode,compensation_type,status,created_at,live_workshop_id,resulting_work_id," +
            "user:profiles!collab_posts_user_id_fkey(display_name,username,avatar_url)," +
            "city:cities!collab_posts_city_id_fkey(name)," +
            "roles:collab_roles(id,role_name,sort_order)",
        )
        .or(
          `and(status.eq.open,or(ends_on.is.null,ends_on.gte.${new Date().toISOString().slice(0, 10)})),and(status.eq.closed,resulting_work_id.not.is.null)`,
        )
        .order("created_at", { ascending: false })
        .limit(9);
      if (error) throw error;
      const rows = (data ?? []) as unknown as (CollabCardData & { user_id: string })[];
      return rows.filter((r) => !blockedIds.has(r.user_id)).slice(0, 3) as CollabCardData[];
    },
  });
  const postIds = useMemo(() => (rawPosts ?? []).map((p) => p.id), [rawPosts]);
  const { data: groupTagMap } = useGroupTagsFor("collab", postIds);
  const myGroupIds = useMyGroupIdSet();
  const posts = useMemo(
    () => rerankByMyGroups(rawPosts ?? [], groupTagMap, myGroupIds),
    [rawPosts, groupTagMap, myGroupIds],
  );

  return (
    <HomeSection
      eyebrow={<><Megaphone className="h-3.5 w-3.5" /> Collabs</>}
      title="People building things now."
      kicker="Open roles across music, film, writing, and code. Help out — or post your own."
      href="/collab"
      cta="All collabs"
    >
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </div>
      ) : !posts || posts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-surface p-12 text-center">
          <h3 className="font-display text-2xl text-ink">No open Collabs right now.</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
            Be the first to post — list the roles, the people show up.
          </p>
          <Link to="/collab/new" className="mt-5 inline-block">
            <Button className="rounded-full">Post a Collab</Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => {
              const author = p.user?.display_name || p.user?.username || "Anon";
              const location = p.location_mode === "online"
                ? "Online"
                : p.city?.name || (p.location_mode === "hybrid" ? "Hybrid" : "In person");
              const roles = (p.roles ?? []).slice(0, 3);
              const extraRoles = Math.max(0, (p.roles?.length ?? 0) - roles.length);
              return (
                <EditorialCard
                  key={p.id}
                  cover={null}
                  coverFallbackClass="gradient-motion"
                  aspect="16/10"
                  coverOverlay={
                    <div className="flex h-full items-center justify-center">
                      <div className="text-center text-primary-foreground">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-80">
                          {CATEGORY_LABELS[p.category] ?? p.category}
                        </div>
                        <div className="mt-1 font-display text-2xl leading-tight">
                          Open Collab
                        </div>
                      </div>
                    </div>
                  }
                  eyebrow={<>by {author} · {location}</>}
                  title={p.title}
                  dek={p.description ?? undefined}
                  chips={
                    <>
                      {roles.map((r) => (
                        <EditorialChip key={r.id}>{r.role_name}</EditorialChip>
                      ))}
                      {extraRoles > 0 && <EditorialChip>+{extraRoles} more</EditorialChip>}
                    </>
                  }
                  href="/collab/$slug"
                  hrefParams={{ slug: p.slug }}
                  ariaLabel={p.title}
                />
              );
            })}
          </div>
          <div className="mt-10 flex justify-center gap-3">
            <Link
              to="/collab"
              className="group inline-flex items-center gap-1 rounded-full border border-border bg-surface px-4 py-2 text-sm text-ink-soft transition hover:bg-muted hover:text-ink"
            >
              Browse the Collab Board
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link to="/collab/new">
              <Button variant="outline" className="rounded-full gap-2">
                <Megaphone className="h-4 w-4" /> Post a Collab
              </Button>
            </Link>
          </div>
        </>
      )}
    </HomeSection>
  );
}

function CityMeetupsStrip() {
  const { data } = useQuery({
    queryKey: ["home-city-meetups"],
    queryFn: async () => {
      const { data } = await supabase
        .from("standing_meetups")
        .select("id,title,description,default_category,city:cities(name,slug)")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });
  if (!data || data.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl border-t border-border/60 px-4 py-10 md:px-6 md:py-12">
      <HomeSectionHeader
        eyebrow={<><Compass className="h-3.5 w-3.5" /> IRL</>}
        title="City meetups"
        kicker="Standing creative gatherings, in real life."
        href="/cities"
        cta="All cities"
      />
      <div className="mt-6 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
        {data.map((m) => (
          <Link
            key={m.id}
            to="/g/$slug"
            params={{ slug: m.city?.slug ?? "" }}
            className="group inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-2 text-sm text-ink-soft transition hover:border-primary/40 hover:bg-muted hover:text-ink"
          >
            <MapPin className="h-3.5 w-3.5 text-ink-muted" />
            <span className="font-medium text-ink">{m.city?.name ?? "—"}</span>
            <span className="text-ink-muted/70">·</span>
            <span className="max-w-[220px] truncate">{m.title}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function NetworkRail() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["network-feed", user?.id],
    queryFn: () => getNetworkFeed(user!.id, 8),
    enabled: !!user?.id,
    staleTime: 60_000,
  });
  // Auto-hide until it has real density.
  if (!user || !data || data.length < 3) return null;
  return (
    <section className="mx-auto max-w-7xl border-t border-border/60 px-4 py-12 md:px-6 md:py-16">
      <HomeSectionHeader
        eyebrow={<><Users className="h-3.5 w-3.5" /> Your network</>}
        title="From people you follow"
        kicker="Fresh work from your collaborators and follows."
      />
      <div className="mt-8 -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0 [scrollbar-width:thin]">
        {data.map((w) => (
          <div key={w.id} className="w-72 shrink-0">
            <EditorialCard
              cover={w.cover_url}
              aspect="16/10"
              eyebrow={CATEGORY_LABELS[w.category] ?? w.category}
              title={w.title}
              href="/works/$slug"
              hrefParams={{ slug: w.slug }}
              ariaLabel={w.title}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

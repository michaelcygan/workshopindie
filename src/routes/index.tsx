import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Megaphone, Radio, Sparkles, MapPin, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { WorkCard, type WorkCardData } from "@/components/work-card";
import { CollabCard, type CollabCardData } from "@/components/collab-card";
import { WORK_CATEGORIES, type Category } from "@/lib/categories";
import { CategoryScroller } from "@/components/category-scroller";
import { getNetworkFeed } from "@/lib/network.functions";
import { useBlockedIds } from "@/hooks/use-blocked-ids";
import { cn } from "@/lib/utils";
import { EtherealBackground } from "@/components/ethereal-background";
import { WorldArcs } from "@/components/world-arcs";
import { YourGroupsStrip } from "@/components/your-groups-strip";
import { HomeLiveWorkshopsRail } from "@/components/home-live-workshops-rail";
import { FeaturedEventsCarousel } from "@/components/featured-events-carousel";
import { UpcomingInMyGroupsRail } from "@/components/upcoming-in-my-groups-rail";
import { useMyGroupIdSet } from "@/hooks/use-my-groups";
import { useGroupTagsFor, rerankByMyGroups } from "@/hooks/use-group-tags";

export const Route = createFileRoute("/")({ component: Index });

type SortKey = "newest" | "trending";

async function fetchWorks(category: Category | "all", sort: SortKey, blockedIds: string[]) {
  let q = supabase
    .from("works")
    .select("id,title,slug,category,cover_url,embed_url,source_type,like_count,save_count,view_count,published_at,popularity_score,created_at,created_by, work_credits(role_label, sort_order, profiles(id,display_name, username))")
    .eq("status", "published")
    .in("visibility", ["public", "unlisted"])
    .limit(12);

  if (category !== "all") q = q.eq("category", category);
  if (sort === "newest") q = q.order("published_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
  else q = q.order("popularity_score", { ascending: false }).order("like_count", { ascending: false });

  const { data, error } = await q;
  if (error) throw error;
  type Row = {
    id: string; title: string; slug: string; category: Category;
    cover_url: string | null; embed_url: string | null; source_type: string;
    like_count: number; save_count: number; view_count: number;
    created_by: string;
    work_credits?: { sort_order: number; profiles: { id: string; display_name: string | null; username: string | null } | null }[];
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
        .map((c) => ({ id: c.profiles?.id ?? null, display_name: c.profiles?.display_name ?? null, username: c.profiles?.username ?? null })),
    }));
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-border min-h-[88vh] flex items-center">
      {/* Ambient ethereal background */}
      <EtherealBackground className="absolute inset-0 -z-20" />
      {/* Warm cream veil for type contrast */}
      <div className="absolute inset-0 -z-10 bg-background/70" />
      <div className="absolute inset-0 -z-10 gradient-soft opacity-60" />
      {/* Animated globe of creative collaborations */}
      <div className="pointer-events-none absolute inset-0 -z-[5] flex items-end justify-center overflow-hidden md:items-center">
        <WorldArcs className="relative h-[72vh] min-h-[520px] w-full opacity-90 md:h-[100vh] md:min-h-[760px] md:w-[118vw] md:max-w-[1600px]" />
      </div>
      <div className="absolute inset-0 -z-[4] bg-gradient-to-b from-background/30 via-transparent to-background/50" />

      <div className="relative mx-auto w-full max-w-6xl px-4 py-10 md:px-6 md:py-14 text-center">
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
          Drop into a live Workshop with other artists and creators. Post a Collab and join a Group of makers in your area or interest.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.18 }}
          className="mx-auto mt-6 grid max-w-3xl gap-4 md:grid-cols-2"
        >
          <Link
            to="/workshop"
            className="gradient-motion group relative flex min-h-[180px] flex-col items-start gap-3 rounded-3xl p-6 text-left text-primary-foreground shadow-lift transition hover:-translate-y-0.5 hover:shadow-xl md:p-7"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary-foreground/15">
              <Radio className="h-5 w-5" />
            </span>
            <div>
              <div className="font-display text-2xl md:text-[26px] leading-tight">Drop into a Workshop</div>
              <p className="mt-2 text-sm md:text-[15px] text-primary-foreground/85">
                A live, five-seat workshop with shared tools. Start a jam, a critique, a hackathon, office hours, or just work alongside other people.
              </p>
            </div>
            <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium opacity-90 transition group-hover:gap-2">
              Drop in <ArrowRight className="h-4 w-4" />
            </span>
          </Link>

          <Link
            to="/collab/new"
            className="group relative flex min-h-[180px] flex-col items-start gap-3 rounded-3xl border border-border bg-surface/95 backdrop-blur p-6 text-left text-ink shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift md:p-7"
          >
            <span className="gradient-motion inline-flex h-10 w-10 items-center justify-center rounded-full text-primary-foreground">
              <Megaphone className="h-5 w-5" />
            </span>
            <div>
              <div className="font-display text-2xl md:text-[26px] leading-tight">Post a Collab</div>
              <p className="mt-2 text-sm md:text-[15px] text-ink-muted">
                Describe what you're working on and accept applications to collaborate. Make your project and showcase it in your portfolio.
              </p>
            </div>
            <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-gradient-motion transition group-hover:gap-2">
              Post a Collab <ArrowRight className="h-4 w-4" />
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
    <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
      <CategoryScroller tabs={tabs} value={category} onChange={setCategory} />
      <div className="flex gap-1 rounded-full border border-border bg-surface p-1 shadow-soft">
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
  const works = useMemo(
    () => rerankByMyGroups(rawWorks ?? [], groupTagMap, myGroupIds),
    [rawWorks, groupTagMap, myGroupIds],
  );

  return (
    <main>
      <Hero />

      <HomeLiveWorkshopsRail />

      <YourGroupsStrip />

      <NetworkRail />

      <CollabsRail />


      <section className="mx-auto max-w-7xl px-4 pt-10 pb-10 md:px-6 md:pt-14 md:pb-14">
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl text-ink md:text-4xl">Works</h2>
            <p className="mt-1 text-sm text-ink-muted">Finished things people made together.</p>
          </div>
        </div>

        <GalleryControls category={category} setCategory={setCategory} sort={sort} setSort={setSort} />

        <div className="mt-6">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-surface-2" />
              ))}
            </div>
          ) : !works || works.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-surface p-12 text-center">
              <h3 className="font-display text-2xl text-ink">Nothing here yet — post your work.</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
                Be the first to post your work and start your portfolio.
              </p>
              <Link to="/works/new" className="mt-5 inline-block">
                <Button className="rounded-full">Post a Work</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {works.map((w) => <WorkCard key={w.id} work={w} groups={groupTagMap?.get(w.id)} myGroupIds={myGroupIds} />)}
              </div>
              <div className="mt-8 text-center">
                <Link
                  to="/gallery"
                  search={{ q: "", tab: "for-you", cat: category, src: "all", sort: sort === "newest" ? "recent" : "trending" }}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-4 py-2 text-sm text-ink-soft hover:bg-muted transition"
                >
                  Browse the full Gallery <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      <CityMeetupsStrip />


      <section className="mx-auto max-w-7xl px-4 pt-10 pb-10 md:px-6 md:pt-14 md:pb-14">
        <FeaturedEventsCarousel />
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 md:px-6">
        <UpcomingInMyGroupsRail />
      </section>
    </main>
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
        .limit(12);
      if (error) throw error;
      const rows = (data ?? []) as unknown as (CollabCardData & { user_id: string })[];
      return rows.filter((r) => !blockedIds.has(r.user_id)).slice(0, 6) as CollabCardData[];
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
    <section className="mx-auto max-w-7xl px-4 pt-10 pb-10 md:px-6 md:pt-14 md:pb-14">

      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl text-ink md:text-4xl">Collabs</h2>
          <p className="mt-1 text-sm text-ink-muted">People building stuff now. Help out — or post your own.</p>
        </div>
        <Link to="/collab/new" className="hidden sm:block">
          <Button variant="outline" className="rounded-full gap-2">
            <Megaphone className="h-4 w-4" /> Post a Collab
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-3xl bg-surface-2" />
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
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {posts.map((p) => <CollabCard key={p.id} post={p} groups={groupTagMap?.get(p.id)} myGroupIds={myGroupIds} />)}
          </div>
          <div className="mt-8 text-center">
            <Link
              to="/collab"
              className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-4 py-2 text-sm text-ink-soft hover:bg-muted transition"
            >
              Browse the Collab Board <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </>
      )}
    </section>
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
        .limit(6);
      return data ?? [];
    },
  });
  if (!data || data.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 pb-4 md:px-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-ink md:text-3xl">City Meetups</h2>
          <p className="mt-1 text-sm text-ink-muted">Standing creative meetups, IRL.</p>
        </div>
        <Link to="/cities" className="text-sm text-gradient-motion hover:underline">All cities →</Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((m) => (
          <Link
            key={m.id}
            to="/cities/$slug"
            params={{ slug: m.city?.slug ?? "" }}
            className="rounded-2xl border border-border bg-surface p-4 transition hover:shadow-soft"
          >
            <div className="flex items-center gap-1.5 text-xs text-ink-muted">
              <MapPin className="h-3.5 w-3.5" /> {m.city?.name ?? "—"}
            </div>
            <h3 className="mt-1 font-display text-lg text-ink line-clamp-1">{m.title}</h3>
            {m.description && <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{m.description}</p>}
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
    <section className="mx-auto max-w-7xl px-4 pt-10 md:px-6 md:pt-14">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-ink md:text-3xl">From your network</h2>
          <p className="mt-1 text-sm text-ink-muted">People you've made things with — and people you follow.</p>
        </div>
      </div>
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        {data.map((w) => (
          <div key={w.id} className="w-64 shrink-0">
            <WorkCard work={w} />
          </div>
        ))}
      </div>
    </section>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { Megaphone, Radio, Sparkles, MapPin, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { WorkCard, type WorkCardData } from "@/components/work-card";
import { WORK_CATEGORIES, type Category } from "@/lib/categories";
import { CategoryScroller } from "@/components/category-scroller";
import { getNetworkFeed } from "@/lib/network.functions";
import { cn } from "@/lib/utils";
import { EtherealBackground } from "@/components/ethereal-background";
import { WorldArcs } from "@/components/world-arcs";

export const Route = createFileRoute("/")({ component: Index });

type SortKey = "newest" | "trending";

async function fetchWorks(category: Category | "all", sort: SortKey) {
  let q = supabase
    .from("works")
    .select("id,title,slug,category,cover_url,embed_url,source_type,like_count,save_count,view_count,published_at,popularity_score,created_at, work_credits(role_label, sort_order, profiles(id,display_name, username))")
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
    work_credits?: { sort_order: number; profiles: { id: string; display_name: string | null; username: string | null } | null }[];
  };
  return (data as Row[]).map<WorkCardData>((r) => ({
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

      <div className="relative mx-auto w-full max-w-6xl px-4 py-20 md:px-6 md:py-28 text-center">
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/90 backdrop-blur px-3 py-1 text-xs text-ink-soft shadow-soft"
        >
          <span className="gradient-motion inline-flex h-5 w-5 items-center justify-center rounded-full text-primary-foreground"><Sparkles className="h-3 w-3" /></span> A creative collaboration network
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.05 }}
          className="font-display mt-5 text-5xl leading-[1.05] tracking-tight text-ink md:text-7xl"
        >
          Find people. <span className="italic text-gradient-motion">Make the thing.</span> <br className="hidden md:block" />
          Show your Work.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
          className="mx-auto mt-5 max-w-xl text-base text-ink-soft md:text-lg"
        >
          Make something with other artists. Find them, create it, ship it.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.18 }}
          className="mx-auto mt-10 grid max-w-3xl gap-4 md:grid-cols-2"
        >
          <Link
            to="/instant"
            className="gradient-motion group relative flex min-h-[180px] flex-col items-start gap-3 rounded-3xl p-6 text-left text-primary-foreground shadow-lift transition hover:-translate-y-0.5 hover:shadow-xl md:p-7"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary-foreground/15">
              <Radio className="h-5 w-5" />
            </span>
            <div>
              <div className="font-display text-2xl md:text-[26px] leading-tight">Drop into a Workshop</div>
              <p className="mt-2 text-sm md:text-[15px] text-primary-foreground/85">
                A live room. Up to 5 artists, voice or video. Walk in, meet people, get to work.
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
                Got an idea sitting in your drafts? Post it. List the roles you need. People show up.
              </p>
            </div>
            <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-gradient-motion transition group-hover:gap-2">
              Post a call <ArrowRight className="h-4 w-4" />
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
  const { data: works, isLoading } = useQuery({
    queryKey: ["works", category, sort],
    queryFn: () => fetchWorks(category, sort),
  });

  return (
    <main>
      <Hero />

      <NetworkRail />

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14">
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl text-ink md:text-4xl">Works Gallery</h2>
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
              <h3 className="font-display text-2xl text-ink">Nothing here yet — go make something.</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
                Drop into a Workshop. Meet people. Build something worth showing.
              </p>
              <Link to="/instant" className="mt-5 inline-block">
                <Button className="rounded-full">Drop into a Workshop</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {works.map((w) => <WorkCard key={w.id} work={w} />)}
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

      <section className="mx-auto max-w-7xl px-4 pb-20 md:px-6">
        <Link
          to="/collab"
          className="group block rounded-2xl border border-border bg-surface p-5 transition hover:shadow-lift"
        >
          <span className="gradient-motion inline-flex h-9 w-9 items-center justify-center rounded-full text-primary-foreground">
            <Megaphone className="h-5 w-5" />
          </span>
          <h3 className="mt-3 font-display text-xl text-ink">Open Collab calls</h3>
          <p className="mt-1 text-sm text-ink-muted">Real projects, real roles. Jump on one.</p>
          <div className="mt-3 text-sm text-gradient-motion group-hover:underline">Browse the board →</div>
        </Link>
      </section>
    </main>
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

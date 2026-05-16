import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Calendar, Radio, Sparkles, MapPin, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { WorkCard, type WorkCardData } from "@/components/work-card";
import { WORK_CATEGORIES, type Category } from "@/lib/categories";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Index });

type SortKey = "newest" | "trending";

async function fetchWorks(category: Category | "all", sort: SortKey) {
  let q = supabase
    .from("works")
    .select("id,title,slug,category,cover_url,source_type,like_count,save_count,view_count,published_at,popularity_score,created_at, work_credits(role_label, sort_order, profiles(display_name, username))")
    .eq("status", "published")
    .in("visibility", ["public", "unlisted"])
    .limit(24);

  if (category !== "all") q = q.eq("category", category);
  if (sort === "newest") q = q.order("published_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
  else q = q.order("popularity_score", { ascending: false }).order("like_count", { ascending: false });

  const { data, error } = await q;
  if (error) throw error;
  type Row = {
    id: string; title: string; slug: string; category: Category;
    cover_url: string | null; source_type: string;
    like_count: number; save_count: number; view_count: number;
    work_credits?: { sort_order: number; profiles: { display_name: string | null; username: string | null } | null }[];
  };
  return (data as Row[]).map<WorkCardData>((r) => ({
    id: r.id, title: r.title, slug: r.slug, category: r.category,
    cover_url: r.cover_url, source_type: r.source_type,
    like_count: r.like_count, save_count: r.save_count, view_count: r.view_count,
    credits: (r.work_credits ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => ({ display_name: c.profiles?.display_name ?? null, username: c.profiles?.username ?? null })),
  }));
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-border min-h-[88vh] flex items-center">
      {/* Ambient video background */}
      <video
        className="absolute inset-0 -z-20 h-full w-full object-cover motion-reduce:hidden"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster="/ambient/studios-loop-poster.jpg"
      >
        <source src="/ambient/studios-loop.mp4" type="video/mp4" />
      </video>
      <img
        src="/ambient/studios-loop-poster.jpg"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 -z-20 h-full w-full object-cover hidden motion-reduce:block"
      />
      {/* Warm cream veil for type contrast */}
      <div className="absolute inset-0 -z-10 bg-background/70" />
      <div className="absolute inset-0 -z-10 gradient-soft opacity-60" />

      <div className="relative mx-auto w-full max-w-6xl px-4 py-20 md:px-6 md:py-28 text-center">
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/90 backdrop-blur px-3 py-1 text-xs text-ink-soft shadow-soft"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" /> A creative collaboration network
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.05 }}
          className="font-display mt-5 text-5xl leading-[1.05] tracking-tight text-ink md:text-7xl"
        >
          Find people. <span className="italic text-primary">Make the thing.</span> <br className="hidden md:block" />
          Show the Work.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
          className="mx-auto mt-5 max-w-xl text-base text-ink-soft md:text-lg"
        >
          Make something with other artists — live, or on a clock.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.18 }}
          className="mx-auto mt-10 grid max-w-3xl gap-4 md:grid-cols-2"
        >
          <Link
            to="/instant"
            className="group relative flex min-h-[180px] flex-col items-start gap-3 rounded-3xl bg-primary p-6 text-left text-primary-foreground shadow-lift transition hover:-translate-y-0.5 hover:shadow-xl md:p-7"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary-foreground/15">
              <Radio className="h-5 w-5" />
            </span>
            <div>
              <div className="font-display text-2xl md:text-[26px] leading-tight">Join an Instant Workshop</div>
              <p className="mt-2 text-sm md:text-[15px] text-primary-foreground/85">
                Drop into a live room with up to 5 artists right now. Voice or video, no scheduling.
              </p>
            </div>
            <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium opacity-90 transition group-hover:gap-2">
              Drop in <ArrowRight className="h-4 w-4" />
            </span>
          </Link>

          <Link
            to="/workshops/new"
            className="group relative flex min-h-[180px] flex-col items-start gap-3 rounded-3xl border border-border bg-surface/95 backdrop-blur p-6 text-left text-ink shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift md:p-7"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Calendar className="h-5 w-5 text-primary" />
            </span>
            <div>
              <div className="font-display text-2xl md:text-[26px] leading-tight">Schedule a Workshop</div>
              <p className="mt-2 text-sm md:text-[15px] text-ink-muted">
                Pick a time, set a prompt, invite collaborators. Ship something on a clock.
              </p>
            </div>
            <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary transition group-hover:gap-2">
              Schedule one <ArrowRight className="h-4 w-4" />
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
  const isMobile = useIsMobile();
  const [paused, setPaused] = useState(false);

  const Chip = ({ t }: { t: { id: Category | "all"; label: string } }) => (
    <button
      key={t.id}
      onClick={() => setCategory(t.id)}
      className={cn(
        "shrink-0 rounded-full px-3 py-1.5 text-sm transition",
        category === t.id ? "bg-ink text-background" : "text-ink-soft hover:bg-muted",
      )}
    >
      {t.label}
    </button>
  );

  return (
    <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
      {isMobile ? (
        <div
          className="relative overflow-hidden rounded-full border border-border bg-surface p-1 shadow-soft"
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div className={cn("flex w-max gap-1 animate-marquee-x", paused && "is-paused")}>
            {[...tabs, ...tabs].map((t, i) => (
              <Chip key={`${t.id}-${i}`} t={t} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1 rounded-full border border-border bg-surface p-1 shadow-soft">
          {tabs.map((t) => <Chip key={t.id} t={t} />)}
        </div>
      )}
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
              <h3 className="font-display text-2xl text-ink">Be the first to ship a Work.</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
                Schedule a Workshop, make something on a clock, then publish it here.
              </p>
              <Link to="/workshops/new" className="mt-5 inline-block">
                <Button className="rounded-full">Schedule a Workshop</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {works.map((w) => <WorkCard key={w.id} work={w} />)}
            </div>
          )}
        </div>
      </section>

      <CityMeetupsStrip />

      <section className="mx-auto max-w-7xl px-4 pb-20 md:px-6">
        <Link
          to="/workshops"
          className="group block rounded-2xl border border-border bg-surface p-5 transition hover:shadow-lift"
        >
          <Calendar className="h-5 w-5 text-primary" />
          <h3 className="mt-3 font-display text-xl text-ink">Upcoming Workshops</h3>
          <p className="mt-1 text-sm text-ink-muted">Apply to a seat or claim a role.</p>
          <div className="mt-3 text-sm text-primary group-hover:underline">Open →</div>
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
        <Link to="/cities" className="text-sm text-primary hover:underline">All cities →</Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(data as any[]).map((m) => (
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

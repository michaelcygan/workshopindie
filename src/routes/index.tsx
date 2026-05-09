import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Radio, Megaphone, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { WorkCard, type WorkCardData } from "@/components/work-card";
import { CATEGORIES, type Category } from "@/lib/categories";
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
    <section className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 gradient-soft" />
      <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-20 md:px-6 md:pt-24 md:pb-28 text-center">
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs text-ink-soft shadow-soft"
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
          Schedule time-boxed creative Workshops, meet collaborators, and build a portfolio from what you ship.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15 }}
          className="mt-7 flex flex-wrap items-center justify-center gap-2"
        >
          <Link to="/workshops/new"><Button size="lg" className="rounded-full gap-2"><Calendar className="h-4 w-4" /> Schedule a Workshop</Button></Link>
          <Link to="/instant"><Button size="lg" variant="outline" className="rounded-full gap-2 bg-surface"><Radio className="h-4 w-4" /> Join Instant</Button></Link>
          <Link to="/collab/new"><Button size="lg" variant="ghost" className="rounded-full gap-2"><Megaphone className="h-4 w-4" /> Post a Collab</Button></Link>
        </motion.div>
      </div>
    </section>
  );
}

function GalleryControls({
  category, setCategory, sort, setSort,
}: { category: Category | "all"; setCategory: (c: Category | "all") => void; sort: SortKey; setSort: (s: SortKey) => void }) {
  const tabs: { id: Category | "all"; label: string }[] = [{ id: "all", label: "All" }, ...CATEGORIES.map((c) => ({ id: c.id, label: c.label }))];
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-1 rounded-full border border-border bg-surface p-1 shadow-soft">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setCategory(t.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm transition",
              category === t.id ? "bg-ink text-background" : "text-ink-soft hover:bg-muted",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
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

      <section className="mx-auto max-w-7xl px-4 pb-20 md:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { title: "Happening Now", body: "Drop into Instant rooms by category and city.", icon: Radio, to: "/instant" as const },
            { title: "Upcoming Workshops", body: "Apply to a seat or claim a role.", icon: Calendar, to: "/workshops" as const },
            { title: "Collab Board", body: "Find collaborators for ideas already in motion.", icon: Megaphone, to: "/collab" as const },
          ].map((c) => (
            <Link key={c.title} to={c.to} className="group rounded-2xl border border-border bg-surface p-5 transition hover:shadow-lift">
              <c.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 font-display text-xl text-ink">{c.title}</h3>
              <p className="mt-1 text-sm text-ink-muted">{c.body}</p>
              <div className="mt-3 text-sm text-primary group-hover:underline">Open →</div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CollabCard, type CollabCardData } from "@/components/collab-card";
import { CATEGORIES, type Category } from "@/lib/categories";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/collab/")({
  component: CollabPage,
  head: () => ({
    meta: [
      { title: "Collab Board — Workshop" },
      { name: "description", content: "Open calls for collaborators. Post your idea or jump on someone else's." },
    ],
  }),
});

type Sort = "newest" | "needs_people";

async function fetchPosts(category: Category | "all", sort: Sort) {
  let q = supabase
    .from("collab_posts")
    .select("id,title,slug,category,description,timeline_text,location_mode,compensation_type,status,created_at,user:profiles!collab_posts_user_id_fkey(display_name,username,avatar_url),city:cities!collab_posts_city_id_fkey(name),roles_count:collab_roles(count)")
    .eq("status", "open")
    .limit(60);

  if (category !== "all") q = q.eq("category", category);
  q = q.order("created_at", { ascending: false });

  const { data, error } = await q;
  if (error) throw error;
  let rows = (data ?? []) as unknown as CollabCardData[];
  if (sort === "needs_people") {
    rows = [...rows].sort((a, b) => (b.roles_count?.[0]?.count ?? 0) - (a.roles_count?.[0]?.count ?? 0));
  }
  return rows;
}

function CollabPage() {
  const [category, setCategory] = useState<Category | "all">("all");
  const [sort, setSort] = useState<Sort>("newest");
  const { data: posts, isLoading } = useQuery({
    queryKey: ["collab", category, sort],
    queryFn: () => fetchPosts(category, sort),
  });

  const tabs: { id: Category | "all"; label: string }[] = [{ id: "all", label: "All" }, ...CATEGORIES.map((c) => ({ id: c.id, label: c.label }))];

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14">
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-ink md:text-5xl">Collab Board</h1>
          <p className="mt-1 text-ink-muted">Ideas already in motion that need people. No clock — just open calls.</p>
        </div>
        <Link to="/collab/new">
          <Button className="rounded-full gap-2"><Megaphone className="h-4 w-4" /> Post a call</Button>
        </Link>
      </motion.div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-full border border-border bg-surface p-1 shadow-soft">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setCategory(t.id)}
              className={cn("rounded-full px-3 py-1.5 text-sm transition",
                category === t.id ? "bg-ink text-background" : "text-ink-soft hover:bg-muted")}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-full border border-border bg-surface p-1 shadow-soft">
          {(["newest", "needs_people"] as Sort[]).map((s) => (
            <button key={s} onClick={() => setSort(s)}
              className={cn("rounded-full px-3 py-1.5 text-sm transition",
                sort === s ? "bg-ink text-background" : "text-ink-soft hover:bg-muted")}>
              {s === "newest" ? "Newest" : "Most roles"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl bg-surface-2" />
            ))}
          </div>
        ) : !posts || posts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-surface p-12 text-center">
            <h3 className="font-display text-2xl text-ink">No open calls yet.</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">Be the first — post the idea you've been sitting on and the roles you need.</p>
            <Link to="/collab/new" className="mt-5 inline-block">
              <Button className="rounded-full">Post a call</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => <CollabCard key={p.id} post={p} />)}
          </div>
        )}
      </div>
    </main>
  );
}

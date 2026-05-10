import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { Radio, Users, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CategoryChip } from "@/components/category-chip";
import { CATEGORIES, type Category } from "@/lib/categories";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/instant/")({
  component: InstantIndex,
  head: () => ({
    meta: [
      { title: "Instant — Workshop" },
      { name: "description", content: "Drop into always-on rooms by category and city. See who's around right now." },
    ],
  }),
});

type Row = {
  id: string;
  title: string;
  category: Category | null;
  status: string;
  created_at: string;
  city: { name: string } | null;
  presence: { count: number }[];
};

async function fetchRooms(category: Category | "all") {
  let q = supabase
    .from("instant_rooms")
    .select("id,title,category,status,created_at,city:cities!instant_rooms_city_id_fkey(name),presence:instant_presence(count)")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(60);
  if (category !== "all") q = q.eq("category", category);
  const { data, error } = await q;
  if (error) throw error;
  // Sort by presence desc client-side
  const rows = (data ?? []) as unknown as Row[];
  return rows.sort((a, b) => (b.presence?.[0]?.count ?? 0) - (a.presence?.[0]?.count ?? 0));
}

function InstantIndex() {
  const [category, setCategory] = useState<Category | "all">("all");
  const { data: rooms, isLoading } = useQuery({
    queryKey: ["instant-rooms", category],
    queryFn: () => fetchRooms(category),
    refetchInterval: 30_000,
  });

  const tabs: { id: Category | "all"; label: string }[] = [{ id: "all", label: "All" }, ...CATEGORIES.map((c) => ({ id: c.id, label: c.label }))];

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14">
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-ink md:text-5xl flex items-center gap-3">
            Instant
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
          </h1>
          <p className="mt-1 text-ink-muted">Always-on rooms. Drop in, hang out, find someone to make something with.</p>
        </div>
        <Link to="/instant/new">
          <Button className="rounded-full gap-2"><Plus className="h-4 w-4" /> Spawn a room</Button>
        </Link>
      </motion.div>

      <div className="mt-8">
        <div className="flex flex-wrap gap-1 rounded-full border border-border bg-surface p-1 shadow-soft w-fit">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setCategory(t.id)}
              className={cn("rounded-full px-3 py-1.5 text-sm transition",
                category === t.id ? "bg-ink text-background" : "text-ink-soft hover:bg-muted")}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-surface-2" />)}
          </div>
        ) : !rooms || rooms.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-surface p-12 text-center">
            <Radio className="mx-auto h-7 w-7 text-primary" />
            <h3 className="mt-3 font-display text-2xl text-ink">No rooms live right now.</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">Spin one up — others will see it on the board.</p>
            <Link to="/instant/new" className="mt-5 inline-block"><Button className="rounded-full">Spawn a room</Button></Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((r) => {
              const count = r.presence?.[0]?.count ?? 0;
              return (
                <motion.div key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2 }}>
                  <Link to="/instant/$id" params={{ id: r.id }}
                    className="group block rounded-2xl border border-border bg-surface p-5 shadow-soft hover:shadow-lift transition">
                    <div className="flex items-center gap-2">
                      {r.category && <CategoryChip category={r.category} />}
                      {r.city?.name && <span className="text-xs text-ink-muted">{r.city.name}</span>}
                      <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-ink-soft">
                        <Users className="h-3 w-3" /> {count}
                      </span>
                    </div>
                    <h3 className="mt-3 font-display text-xl text-ink line-clamp-2">{r.title}</h3>
                    <div className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary">
                      {count > 0 && <span className="relative inline-flex h-2 w-2">
                        <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                      </span>}
                      Drop in →
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

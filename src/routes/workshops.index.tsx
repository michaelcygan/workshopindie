import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { WorkshopCard, type WorkshopCardData } from "@/components/workshop-card";
import { CATEGORIES, type Category } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { getMyAgeFields } from "@/lib/profile-age.functions";

export const Route = createFileRoute("/workshops/")({
  head: () => ({
    meta: [
      { title: "Workshops — what's on, what's next" },
      { name: "description", content: "What's running right now, what's coming up, and what's near you. RSVP, or just drop in." },
      { property: "og:title", content: "Workshops — Workshop" },
      { property: "og:description", content: "What's running right now, what's coming up, and what's near you. RSVP, or just drop in." },
    ],
  }),
  component: WorkshopsPage,
});

type Filter = "upcoming" | "happening" | "all";

async function fetchWorkshops(category: Category | "all", filter: Filter) {
  let q = supabase
    .from("workshops")
    .select("id,title,slug,category,prompt,starts_at,ends_at,location_type,location_text,participant_cap,confirmed_count,application_count,status,min_age,max_age,hide_from_ineligible,audience_city_ids,host_user_id,host:profiles!workshops_host_user_id_fkey(display_name,username,avatar_url)")
    .eq("visibility", "public")
    .in("status", ["open", "check_in", "active", "finalizing", "shipped"])
    .limit(40);

  if (category !== "all") q = q.eq("category", category);
  const now = new Date().toISOString();
  if (filter === "upcoming") q = q.gte("starts_at", now).order("starts_at", { ascending: true });
  else if (filter === "happening") q = q.lte("starts_at", now).gte("ends_at", now).order("starts_at", { ascending: false });
  else q = q.order("starts_at", { ascending: false, nullsFirst: false });

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as (WorkshopCardData & { min_age: number | null; max_age: number | null; hide_from_ineligible: boolean; audience_city_ids: string[]; host_user_id: string })[];
}

function WorkshopsPage() {
  const { user } = useAuth();
  const [category, setCategory] = useState<Category | "all">("all");
  const [filter, setFilter] = useState<Filter>("upcoming");

  const getAge = useServerFn(getMyAgeFields);
  const { data: ageCtx } = useQuery({
    queryKey: ["my-age-ctx", user?.id],
    queryFn: () => getAge(),
    enabled: !!user,
    staleTime: 60_000,
  });
  const { data: rawWorkshops, isLoading } = useQuery({
    queryKey: ["workshops", category, filter],
    queryFn: () => fetchWorkshops(category, filter),
  });

  const ageFilterMin = ageCtx?.ageFilterMin ?? null;
  const myAge = ageCtx?.age ?? null;
  const workshops = (rawWorkshops ?? []).filter((w) => {
    // User opted into 18+/21+ only → hide teen-capped workshops
    if (ageFilterMin != null && w.max_age != null && w.max_age < ageFilterMin) return false;
    // Host opted to hide from ineligible → respect when we know the viewer's age
    if (w.hide_from_ineligible && myAge != null) {
      if (w.min_age != null && myAge < w.min_age) return false;
      if (w.max_age != null && myAge > w.max_age) return false;
    }
    return true;
  });

  const tabs: { id: Category | "all"; label: string }[] = [{ id: "all", label: "All" }, ...CATEGORIES.map((c) => ({ id: c.id, label: c.label }))];

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14">
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-ink md:text-5xl">Workshops</h1>
          <p className="mt-1 text-ink-muted">Scheduled Workshops you can RSVP to. Or skip the wait — <Link to="/instant" className="underline hover:text-ink">drop in</Link>.</p>
        </div>
        <Link to="/workshops/new">
          <Button className="rounded-full gap-2"><Calendar className="h-4 w-4" /> Schedule</Button>
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
          {(["upcoming", "happening", "all"] as Filter[]).map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={cn("rounded-full px-3 py-1.5 text-sm capitalize transition",
                filter === s ? "bg-ink text-background" : "text-ink-soft hover:bg-muted")}>
              {s === "happening" ? "Happening now" : s}
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
        ) : !workshops || workshops.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-surface p-12 text-center">
            <h3 className="font-display text-2xl text-ink">Nothing on the books.</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
              Post a Collab, pick a time — the Workshop schedules itself.
            </p>
            <Link to="/workshops/new" className="mt-5 inline-block">
              <Button className="rounded-full">Schedule a Workshop</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {workshops.map((w) => <WorkshopCard key={w.id} ws={w} />)}
          </div>
        )}
      </div>
    </main>
  );
}

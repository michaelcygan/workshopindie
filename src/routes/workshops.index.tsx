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
import { useUserRoles } from "@/hooks/use-user-role";
import { useAuth } from "@/hooks/use-auth";
import { ComingSoon } from "@/components/coming-soon";
import { getMyAgeFields } from "@/lib/profile-age.functions";

export const Route = createFileRoute("/workshops/")({
  head: () => ({
    meta: [
      { title: "Workshops — Find people. Make the thing. — Workshop" },
      { name: "description", content: "Time-boxed creative sessions. Apply for a role, show up, ship work together." },
      { property: "og:title", content: "Workshops — Workshop" },
      { property: "og:description", content: "Time-boxed creative sessions. Apply for a role, show up, ship work together." },
    ],
  }),
  component: WorkshopsPage,
});

type Filter = "upcoming" | "happening" | "all";

async function fetchWorkshops(category: Category | "all", filter: Filter) {
  let q = supabase
    .from("workshops")
    .select("id,title,slug,category,prompt,starts_at,ends_at,location_type,location_text,participant_cap,confirmed_count,application_count,status,host:profiles!workshops_host_user_id_fkey(display_name,username,avatar_url)")
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
  return (data ?? []) as unknown as WorkshopCardData[];
}

function WorkshopsPage() {
  const { isAdmin, loading: rolesLoading } = useUserRoles();
  const [category, setCategory] = useState<Category | "all">("all");
  const [filter, setFilter] = useState<Filter>("upcoming");

  if (rolesLoading) {
    return <main className="mx-auto max-w-2xl p-10"><div className="h-40 animate-pulse rounded-3xl bg-surface-2" /></main>;
  }
  if (!isAdmin) {
    return (
      <ComingSoon
        title="Scheduled Workshops"
        blurb="Coming soon — for now, drop into a live Workshop or post a Collab to find people."
        ctaLabel="Back to home"
      />
    );
  }
  const { data: workshops, isLoading } = useQuery({
    queryKey: ["workshops", category, filter],
    queryFn: () => fetchWorkshops(category, filter),
  });

  const tabs: { id: Category | "all"; label: string }[] = [{ id: "all", label: "All" }, ...CATEGORIES.map((c) => ({ id: c.id, label: c.label }))];

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14">
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-ink md:text-5xl">Workshops</h1>
          <p className="mt-1 text-ink-muted">Time-boxed creative sessions. Apply, show up, make the thing.</p>
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
            <h3 className="font-display text-2xl text-ink">No Workshops yet — schedule the first one.</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
              Pick a category, set a clock, define roles. People will apply.
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

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Calendar, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { WorkshopCard, type WorkshopCardData } from "@/components/workshop-card";
import { CATEGORIES, type Category } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { PageHeaderCompact } from "@/components/page-header-compact";
import { KickerChip } from "@/components/kicker-chip";
import { RecapChip } from "@/components/recap-chip";
import { EmptySpark } from "@/components/empty-spark";
import { useAuth } from "@/hooks/use-auth";
import { getMyAgeFields } from "@/lib/profile-age.functions";
import { LobbiesSection } from "@/components/lobbies-section";
import { YourGroupsStrip } from "@/components/your-groups-strip";
import { useMyGroupIdSet } from "@/hooks/use-my-groups";
import { useGroupTagsFor, rerankByMyGroups } from "@/hooks/use-group-tags";
import { useMemo } from "react";

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
  const myHomeCityId = ageCtx?.homeCityId ?? null;
  const filteredWorkshops = (rawWorkshops ?? []).filter((w) => {
    // User opted into 18+/21+ only → hide teen-capped workshops
    if (ageFilterMin != null && w.max_age != null && w.max_age < ageFilterMin) return false;
    // Host opted to hide from ineligible → respect when we know the viewer's age
    if (w.hide_from_ineligible && myAge != null) {
      if (w.min_age != null && myAge < w.min_age) return false;
      if (w.max_age != null && myAge > w.max_age) return false;
    }
    // City-scoped workshops: only visible to viewers in one of the audience cities,
    // or to the host themselves. Anonymous viewers don't see city-scoped workshops.
    if (w.audience_city_ids && w.audience_city_ids.length > 0) {
      const isHost = !!user && w.host_user_id === user.id;
      const inCity = !!myHomeCityId && w.audience_city_ids.includes(myHomeCityId);
      if (!isHost && !inCity) return false;
    }
    return true;
  });

  const workshopIds = useMemo(() => filteredWorkshops.map((w) => w.id), [filteredWorkshops]);
  const { data: groupTagMap } = useGroupTagsFor("workshop", workshopIds);
  const myGroupIds = useMyGroupIdSet();
  const workshops = useMemo(
    () => rerankByMyGroups(filteredWorkshops, groupTagMap, myGroupIds),
    [filteredWorkshops, groupTagMap, myGroupIds],
  );

  const tabs: { id: Category | "all"; label: string }[] = [{ id: "all", label: "All" }, ...CATEGORIES.map((c) => ({ id: c.id, label: c.label }))];

  const happeningCount = (rawWorkshops ?? []).filter((w) => w.status === "active" || w.status === "check_in").length;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <YourGroupsStrip className="-mx-4 -mt-6 mb-6 rounded-none border-b md:-mx-6 md:-mt-8" />

      <PageHeaderCompact
        title="Workshops"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/workshops/lobby/new">
              <Button variant="outline" size="sm" className="rounded-full gap-2"><Sparkles className="h-4 w-4" /> Draft</Button>
            </Link>
            <Link to="/workshops/new">
              <Button size="sm" className="rounded-full gap-2"><Calendar className="h-4 w-4" /> Schedule</Button>
            </Link>
          </div>
        }
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <KickerChip live={happeningCount > 0}>
          {happeningCount > 0 ? `${happeningCount} happening now` : "On the books"}
        </KickerChip>
        <p className="text-sm text-ink-muted">
          RSVP to what's scheduled — or skip the wait and{" "}
          <Link to="/workshop" className="underline hover:text-ink">drop in</Link>.
        </p>
        <RecapChip count={workshops?.length ?? 0} label="in the rotation" />
      </div>

      {user && <LobbiesSection />}

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
          <EmptySpark
            title="Nothing on the books."
            body="Post a Collab, pick a time — the Workshop schedules itself."
            action={
              <Link to="/workshops/new">
                <Button className="rounded-full">Schedule a Workshop</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {workshops.map((w) => <WorkshopCard key={w.id} ws={w} groups={groupTagMap?.get(w.id)} myGroupIds={myGroupIds} />)}
          </div>
        )}
      </div>
    </main>
  );
}

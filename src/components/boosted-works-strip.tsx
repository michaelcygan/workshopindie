import { useQuery } from "@tanstack/react-query";
import { Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WorkCard, type WorkCardData } from "./work-card";

async function fetchBoostedWorks(): Promise<WorkCardData[]> {
  const { data: boosts } = await supabase
    .from("work_boosts")
    .select("work_id,created_at")
    .order("created_at", { ascending: false })
    .limit(8);
  const ids = Array.from(new Set((boosts ?? []).map((b) => b.work_id as string)));
  if (ids.length === 0) return [];
  const { data: works } = await supabase
    .from("works")
    .select(
      "id,title,slug,category,cover_url,embed_url,source_type,like_count,save_count,view_count,vouch_count,boost_count,published_at,created_by, work_credits(role_label,sort_order,display_name, profiles(id,display_name,username))",
    )
    .in("id", ids)
    .eq("status", "published")
    .in("visibility", ["public", "unlisted"]);
  const byId = new Map<string, WorkCardData>();
  for (const w of (works ?? []) as unknown as Array<
    WorkCardData & {
      work_credits?: {
        sort_order: number;
        display_name: string | null;
        profiles: {
          id: string;
          display_name: string | null;
          username: string | null;
        } | null;
      }[];
    }
  >) {
    byId.set(w.id, {
      ...w,
      credits: (w.work_credits ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((c) => ({
          id: c.profiles?.id ?? null,
          display_name: c.profiles?.display_name ?? c.display_name ?? null,
          username: c.profiles?.username ?? null,
        })),
    });
  }
  return ids.map((id) => byId.get(id)).filter(Boolean) as WorkCardData[];
}

export function BoostedWorksStrip() {
  const { data } = useQuery({
    queryKey: ["boosted-works"],
    queryFn: fetchBoostedWorks,
    staleTime: 30_000,
  });
  const works = data ?? [];
  if (works.length === 0) return null;
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <div className="mb-3 flex items-center gap-2">
          <Rocket className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink">
            Boosted by the community
          </h2>
        </div>
        <div className="-mx-1 grid grid-flow-col auto-cols-[60%] gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:auto-cols-[40%] md:auto-cols-[28%] lg:auto-cols-[22%] [&::-webkit-scrollbar]:hidden">
          {works.map((w) => (
            <WorkCard key={w.id} work={w} />
          ))}
        </div>
      </div>
    </section>
  );
}

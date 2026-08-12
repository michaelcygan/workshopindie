import { useQuery } from "@tanstack/react-query";
import { ExternalLink, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { resourceCategoryLabel, type ResourceRow } from "@/lib/resources/types";

type GroupResource = ResourceRow & { display_order: number };

async function fetchGroupResources(groupId: string): Promise<GroupResource[]> {
  const { data, error } = await supabase
    .from("group_resources")
    .select(
      "display_order,resources!inner(id,name,category,useful_for,short_description,website_url,location_text,address,image_url,city_id,fields,is_published,created_at,updated_at)",
    )
    .eq("group_id", groupId)
    .eq("resources.is_published", true)
    .order("display_order", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as any[]).map((row) => ({
    ...(row.resources as ResourceRow),
    display_order: row.display_order as number,
  }));
}

/** Published resource count — drives whether the Resources tab renders at all. */
export function useGroupResourceCount(groupId: string) {
  const { data, isLoading } = useQuery({
    queryKey: ["group", groupId, "resources"],
    queryFn: () => fetchGroupResources(groupId),
    staleTime: 60_000,
  });
  return { count: data?.length ?? 0, isLoading };
}

export function GroupResourcesTab({ group }: { group: { id: string } }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["group", group.id, "resources"],
    queryFn: () => fetchGroupResources(group.id),
    staleTime: 60_000,
  });

  if (isLoading || data.length === 0) return null;

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="font-display text-2xl text-ink">Resources</h2>
        <p className="text-sm text-ink-muted">
          Places, services and organizations useful to this community.
        </p>
      </header>

      <ul className="divide-y divide-border border-y border-border">
        {data.map((r) => {
          const category = resourceCategoryLabel(r.category);
          return (
            <li key={r.id} className="py-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <h3 className="text-base font-medium text-ink">
                      {r.website_url ? (
                        <a
                          href={r.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block min-h-[32px] underline-offset-4 hover:underline focus-visible:underline"
                        >
                          {r.name}
                        </a>
                      ) : (
                        r.name
                      )}
                    </h3>
                    {category && (
                      <span className="text-[11px] uppercase tracking-wider text-ink-muted">
                        {category}
                      </span>
                    )}
                  </div>
                  {r.useful_for && <p className="text-sm text-ink">{r.useful_for}</p>}
                  {r.short_description && (
                    <p className="text-sm text-ink-muted">{r.short_description}</p>
                  )}
                  {(r.location_text || r.address) && (
                    <p className="flex items-center gap-1.5 text-xs text-ink-muted">
                      <MapPin className="h-3.5 w-3.5" />
                      {[r.location_text, r.address].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>

                {r.website_url && (
                  <a
                    href={r.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1.5 text-sm text-ink underline underline-offset-4 hover:text-primary"
                  >
                    Website <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

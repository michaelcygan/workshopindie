import { ExternalLink, Users } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CategoryChipsCompact } from "@/components/category-chips";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import type { Category } from "@/lib/categories";

type CollabRow = {
  id: string;
  title: string;
  slug: string;
  category: Category;
  categories?: Category[] | null;
  description: string | null;
  user_id: string;
  status: string;
  roles: { id: string; role_name: string; quantity: number }[];
};

type Creator = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

async function fetchCollabPeek(collabId: string): Promise<{ collab: CollabRow | null; creator: Creator | null }> {
  const { data: c, error } = await supabase
    .from("collab_posts")
    .select(
      "id,title,slug,category,categories,description,user_id,status,roles:collab_roles(id,role_name,quantity,sort_order)",
    )
    .eq("id", collabId)
    .maybeSingle();
  if (error) throw error;
  if (!c) return { collab: null, creator: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("id,display_name,username,avatar_url")
    .eq("id", (c as any).user_id)
    .maybeSingle();
  return {
    collab: c as unknown as CollabRow,
    creator: (profile as Creator | null) ?? null,
  };
}

export function collabPeekQueryOptions(collabId: string | null) {
  return queryOptions({
    queryKey: ["collab-peek", collabId] as const,
    queryFn: () => fetchCollabPeek(collabId!),
    enabled: !!collabId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

export function CollabPeek({
  collabId,
  open,
  onOpenChange,
  onCreatorClick,
}: {
  collabId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreatorClick?: (userId: string) => void;
}) {
  const { data, isLoading } = useQuery({
    ...collabPeekQueryOptions(collabId),
    enabled: open && !!collabId,
  });

  const collab = data?.collab ?? null;
  const creator = data?.creator ?? null;


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden gap-0">
        <DialogTitle className="sr-only">{collab?.title ?? "Collab"}</DialogTitle>
        {isLoading || !collab ? (
          <div className="space-y-0">
            <Skeleton className="aspect-video w-full rounded-none" />
            <div className="p-5 space-y-3">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-8 w-24 rounded-full" />
                <Skeleton className="h-8 w-20 rounded-full" />
              </div>
            </div>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
            {collab.cover_url ? (
              <div className="relative aspect-video w-full overflow-hidden bg-surface-2">
                <img src={collab.cover_url} alt={collab.title} className="h-full w-full object-cover" />
                <div className="absolute left-3 top-3 flex gap-1.5">
                  <CategoryChipsCompact primary={collab.category} categories={collab.categories} />
                </div>
              </div>
            ) : (
              <div className="relative aspect-video w-full gradient-soft">
                <div className="absolute left-3 top-3 flex gap-1.5">
                  <CategoryChipsCompact primary={collab.category} categories={collab.categories} />
                </div>
              </div>
            )}
            <div className="p-5 space-y-4">
              <div>
                <h2 className="font-display text-2xl text-ink leading-tight">{collab.title}</h2>
                {collab.description && (
                  <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink-soft line-clamp-6">
                    {collab.description}
                  </p>
                )}
              </div>

              {creator && (
                <button
                  type="button"
                  onClick={() => onCreatorClick?.(creator.id)}
                  className="flex items-center gap-2 rounded-full hover:bg-muted -ml-1 pr-3 pl-1 py-1 transition"
                >
                  <div className="h-7 w-7 overflow-hidden rounded-full bg-muted text-xs flex items-center justify-center text-ink-muted">
                    {creator.avatar_url ? (
                      <img src={creator.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (creator.display_name?.[0] || creator.username?.[0] || "?").toUpperCase()
                    )}
                  </div>
                  <span className="text-sm text-ink">
                    {creator.display_name || creator.username || "Anon"}
                  </span>
                </button>
              )}

              {collab.roles.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-ink-muted">
                    <Users className="h-3 w-3" /> Open roles
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {collab.roles.map((r) => (
                      <span
                        key={r.id}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-ink-soft"
                      >
                        {r.role_name}
                        {r.quantity > 1 && (
                          <span className="text-ink-muted">×{r.quantity}</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end pt-2">
                <Button asChild size="sm" className="rounded-full gap-1.5">
                  <a href={`/collab/${collab.slug}`} target="_blank" rel="noopener noreferrer">
                    Open & apply <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
}

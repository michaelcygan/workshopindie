import { useState } from "react";
import { Heart, Bookmark, Eye, ExternalLink, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CategoryChips } from "@/components/category-chips";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SOURCE_LABELS, type Category } from "@/lib/categories";
import { cn, formatCount } from "@/lib/utils";
import { getWorkPeekDetail } from "@/lib/works-peek.functions";
import { useWorkLike } from "@/hooks/use-work-like";
import { SignupGateModal } from "@/components/signup-gate-modal";

export type WorkPeekData = {
  id: string;
  title: string;
  slug: string;
  category: Category;
  categories?: Category[] | null;
  cover_url: string | null;
  excerpt: string | null;
  description: string | null;
  source_type: string;
  like_count: number;
  save_count: number;
  view_count: number;
  comment_count: number;
  created_by: string;
};

type Creator = { id: string; display_name: string | null; username: string | null; avatar_url: string | null };

export function WorkPeek({
  workId,
  open,
  onOpenChange,
  onCreatorClick,
}: {
  workId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreatorClick?: (userId: string) => void;
}) {
  const fetchPeek = useServerFn(getWorkPeekDetail);
  const { data, isLoading } = useQuery({
    queryKey: ["work-peek", workId],
    queryFn: () => fetchPeek({ data: { workId: workId! } }),
    enabled: open && !!workId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const work = (data?.work ?? null) as WorkPeekData | null;
  const creator = (data?.creator ?? null) as Creator | null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden gap-0">
        <DialogTitle className="sr-only">{work?.title ?? "Work"}</DialogTitle>
        {isLoading || !work ? (
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
            {work.cover_url ? (
              <div className="relative aspect-video w-full overflow-hidden bg-surface-2">
                <img src={work.cover_url} alt={work.title} className="h-full w-full object-cover" />
                <div className="absolute left-3 top-3 flex gap-1.5">
                  <CategoryChips primary={work.category} categories={work.categories} />
                </div>
                <div className="absolute right-3 top-3 rounded-full bg-surface/90 backdrop-blur px-2.5 py-0.5 text-[11px] font-medium text-ink-soft">
                  {SOURCE_LABELS[work.source_type] ?? work.source_type}
                </div>
              </div>
            ) : (
              <div className="aspect-video w-full gradient-soft" />
            )}
            <div className="p-5 space-y-4">
              <div>
                <h2 className="font-display text-2xl text-ink leading-tight">{work.title}</h2>
                {work.excerpt && (
                  <p className="mt-1.5 text-sm text-ink-soft line-clamp-3">{work.excerpt}</p>
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
              <div className="flex items-center gap-4 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {formatCount(work.like_count)}</span>
                <span className="inline-flex items-center gap-1"><Bookmark className="h-3.5 w-3.5" /> {formatCount(work.save_count)}</span>
                <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> {formatCount(work.comment_count)}</span>
                <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {formatCount(work.view_count)}</span>
              </div>
              <div className="flex items-center justify-end pt-2">
                <Button asChild variant="outline" size="sm" className="rounded-full gap-1.5">
                  <a href={`/works/${work.slug}`} target="_blank" rel="noopener noreferrer">
                    Open full work <ExternalLink className="h-3.5 w-3.5" />
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

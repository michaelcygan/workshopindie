import { useEffect, useState } from "react";
import { Heart, Bookmark, Eye, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CategoryChip } from "@/components/category-chip";
import { Button } from "@/components/ui/button";
import { SOURCE_LABELS, type Category } from "@/lib/categories";

export type WorkPeekData = {
  id: string;
  title: string;
  slug: string;
  category: Category;
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
  const [work, setWork] = useState<WorkPeekData | null>(null);
  const [creator, setCreator] = useState<Creator | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !workId) return;
    let cancelled = false;
    setLoading(true);
    setWork(null);
    setCreator(null);
    (async () => {
      const { data } = await supabase
        .from("works")
        .select("id,title,slug,category,cover_url,excerpt,description,source_type,like_count,save_count,view_count,comment_count,created_by")
        .eq("id", workId)
        .maybeSingle();
      if (cancelled) return;
      setWork((data as WorkPeekData | null) ?? null);
      if (data?.created_by) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id,display_name,username,avatar_url")
          .eq("id", data.created_by)
          .maybeSingle();
        if (!cancelled) setCreator((prof as Creator | null) ?? null);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, workId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden gap-0">
        <DialogTitle className="sr-only">{work?.title ?? "Work"}</DialogTitle>
        {loading || !work ? (
          <div className="flex h-64 items-center justify-center text-sm text-ink-muted">Loading…</div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
            {work.cover_url ? (
              <div className="relative aspect-video w-full overflow-hidden bg-surface-2">
                <img src={work.cover_url} alt={work.title} className="h-full w-full object-cover" />
                <div className="absolute left-3 top-3 flex gap-1.5">
                  <CategoryChip category={work.category} />
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
                <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {work.like_count}</span>
                <span className="inline-flex items-center gap-1"><Bookmark className="h-3.5 w-3.5" /> {work.save_count}</span>
                <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {work.view_count}</span>
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

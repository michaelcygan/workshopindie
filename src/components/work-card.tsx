import { motion } from "framer-motion";
import { Heart, Bookmark, Eye } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { CategoryChip } from "./category-chip";
import { SOURCE_LABELS, type Category } from "@/lib/categories";
import { cn } from "@/lib/utils";

export type WorkCardData = {
  id: string;
  title: string;
  slug: string;
  category: Category;
  cover_url: string | null;
  source_type: string;
  like_count: number;
  save_count: number;
  view_count: number;
  credits?: { display_name: string | null; username: string | null }[];
};

export function WorkCard({ work, className }: { work: WorkCardData; className?: string }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl bg-surface border border-border shadow-soft hover:shadow-lift transition-shadow",
        className,
      )}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-surface-2">
        {work.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={work.cover_url}
            alt={work.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="h-full w-full gradient-soft" />
        )}
        <div className="absolute left-3 top-3 flex gap-1.5">
          <CategoryChip category={work.category} />
        </div>
        <div className="absolute right-3 top-3 rounded-full bg-surface/90 backdrop-blur px-2.5 py-0.5 text-[11px] font-medium text-ink-soft">
          {SOURCE_LABELS[work.source_type] ?? work.source_type}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-display text-lg leading-tight text-ink line-clamp-2">{work.title}</h3>
        {work.credits && work.credits.length > 0 && (
          <p className="text-xs text-ink-muted line-clamp-1">
            by {work.credits.map((c) => c.display_name || c.username || "Anon").join(", ")}
          </p>
        )}
        <div className="mt-auto flex items-center gap-3 pt-2 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {work.like_count}</span>
          <span className="inline-flex items-center gap-1"><Bookmark className="h-3.5 w-3.5" /> {work.save_count}</span>
          <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {work.view_count}</span>
        </div>
      </div>
    </motion.article>
  );
}

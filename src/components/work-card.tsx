import { motion } from "framer-motion";
import { Heart, Bookmark, Eye, Play, Rocket, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { CategoryChip } from "./category-chip";
import { ProfilePeek } from "./profile-peek";
import { providerFromUrl, providerLabel } from "./embed-player";
import { InlineGroupChips } from "./inline-group-chips";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { GroupTag } from "@/hooks/use-group-tags";
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
  vouch_count?: number;
  boost_count?: number;
  published_at?: string | null;
  created_by?: string;
  embed_url?: string | null;
  credits?: { id?: string | null; display_name: string | null; username: string | null; avatar_url?: string | null }[];
};

type Density = "compact" | "default" | "hero";

export function WorkCard({
  work,
  groups,
  myGroupIds,
  className,
  showAvatars = false,
  showCounters = true,
  showCategory = true,
  density = "default",
  onOpen,
  creditBadge,
}: {
  work: WorkCardData;
  groups?: GroupTag[];
  myGroupIds?: Set<string>;
  className?: string;
  showAvatars?: boolean;
  showCounters?: boolean;
  showCategory?: boolean;
  density?: Density;
  onOpen?: (work: WorkCardData) => void;
  creditBadge?: string | null;
}) {
  const credits = work.credits ?? [];
  const shown = credits.slice(0, 3);
  const extra = credits.length - shown.length;
  const provider = work.embed_url ? providerFromUrl(work.embed_url) : null;
  const pLabel = providerLabel(provider);
  const isFresh =
    !!work.published_at &&
    Date.now() - new Date(work.published_at).getTime() < 24 * 60 * 60 * 1000;
  const vouchCount = work.vouch_count ?? 0;
  const boostCount = work.boost_count ?? 0;
  const titleClass = density === "hero" ? "font-display text-2xl leading-tight" : "font-display text-lg leading-tight";
  const padClass = density === "hero" ? "p-5" : "p-4";

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl bg-surface border border-border shadow-soft hover:shadow-lift transition-shadow",
        className,
      )}
    >
      {onOpen ? (
        <button
          type="button"
          onClick={() => onOpen(work)}
          aria-label={`Open ${work.title}`}
          className="absolute inset-0 z-10 cursor-zoom-in"
        />
      ) : (
        <Link to="/works/$slug" params={{ slug: work.slug }} className="absolute inset-0 z-10" aria-label={work.title} />
      )}
      <div className={cn("relative overflow-hidden bg-surface-2", density === "hero" ? "aspect-[16/10]" : "aspect-[4/5]")}>
        {work.cover_url ? (
          <img
            src={work.cover_url}
            alt={work.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="h-full w-full gradient-soft" />
        )}
        {showCategory && (
          <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
            <CategoryChip category={work.category} />
            {isFresh && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/95 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground shadow-soft">
                <Sparkles className="h-2.5 w-2.5" /> Fresh
              </span>
            )}
          </div>
        )}
        <div className="absolute right-3 top-3 flex flex-col items-end gap-1">
          <div className="rounded-full bg-surface/90 backdrop-blur px-2.5 py-0.5 text-[11px] font-medium text-ink-soft">
            {SOURCE_LABELS[work.source_type] ?? work.source_type}
          </div>
          {boostCount > 0 && (
            <div className="inline-flex items-center gap-1 rounded-full bg-primary/95 px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-soft">
              <Rocket className="h-2.5 w-2.5" /> Boosted
            </div>
          )}
        </div>
        {showAvatars && shown.length > 0 && (
          <div className="absolute bottom-3 left-3 z-20 flex -space-x-2">
            {shown.map((c, i) => {
              const name = c.display_name || c.username || "Anon";
              return (
                <Avatar key={`${c.id ?? i}-${i}`} className="h-7 w-7 ring-2 ring-background">
                  <AvatarImage src={c.avatar_url ?? undefined} alt={name} />
                  <AvatarFallback className="text-[10px]">{name[0]}</AvatarFallback>
                </Avatar>
              );
            })}
            {extra > 0 && (
              <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-background/90 px-1.5 text-[10px] font-medium text-ink ring-2 ring-background">
                +{extra}
              </span>
            )}
          </div>
        )}
        {work.embed_url && (
          <>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-background/90 backdrop-blur shadow-lift">
                <Play className="h-6 w-6 fill-ink text-ink translate-x-0.5" />
              </span>
            </div>
            {pLabel && !showAvatars && (
              <div className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-background/90 backdrop-blur px-2 py-0.5 text-[10px] font-medium text-ink-soft">
                <Play className="h-2.5 w-2.5" /> {pLabel}
              </div>
            )}
          </>
        )}
      </div>
      <div className={cn("flex flex-1 flex-col gap-2", padClass)}>
        <h3 className={cn(titleClass, "text-ink line-clamp-2")}>{work.title}</h3>
        <InlineGroupChips groups={groups} myGroupIds={myGroupIds} />
        {shown.length > 0 && (
          <p className="relative z-20 text-xs text-ink-muted line-clamp-1">
            by{" "}
            {shown.map((c, i) => {
              const name = c.display_name || c.username || "Anon";
              const sep = i < shown.length - 1 ? ", " : extra > 0 ? `, +${extra}` : "";
              const inner = (
                <span className="text-ink-soft hover:text-ink hover:underline underline-offset-2 transition">{name}</span>
              );
              if (c.id) {
                return (
                  <span key={`${c.id}-${i}`}>
                    <ProfilePeek userId={c.id}>
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className="cursor-pointer"
                      >
                        {inner}
                      </button>
                    </ProfilePeek>
                    {sep}
                  </span>
                );
              }
              return <span key={i}>{inner}{sep}</span>;
            })}
          </p>
        )}
        {showCounters && (
          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-ink-muted">
            <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {work.like_count}</span>
            <span className="inline-flex items-center gap-1"><Bookmark className="h-3.5 w-3.5" /> {work.save_count}</span>
            <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {work.view_count}</span>
            {vouchCount > 0 && (
              <span className="inline-flex items-center gap-1 text-ink-soft">
                <ShieldCheck className="h-3.5 w-3.5" /> {vouchCount}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.article>
  );
}

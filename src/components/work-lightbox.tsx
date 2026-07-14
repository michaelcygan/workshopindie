import { useEffect, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, X, Heart, Bookmark, Eye, ExternalLink } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { CategoryChips } from "./category-chips";
import { EmbedPlayer, providerFromUrl } from "./embed-player";
import { ProfilePeek } from "./profile-peek";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WorkCardData } from "./work-card";

export type LightboxWork = WorkCardData & {
  my_role?: string;
  owner?: { id: string; display_name: string | null; username: string | null } | null;
};

export function WorkLightbox({
  works,
  activeId,
  onChange,
  onClose,
}: {
  works: LightboxWork[];
  activeId: string | null;
  onChange: (id: string | null) => void;
  onClose: () => void;
}) {
  const idx = activeId ? works.findIndex((w) => w.id === activeId || w.slug === activeId) : -1;
  const work = idx >= 0 ? works[idx] : null;
  const open = !!work;

  const goPrev = useCallback(() => {
    if (idx > 0) onChange(works[idx - 1].slug);
  }, [idx, works, onChange]);
  const goNext = useCallback(() => {
    if (idx >= 0 && idx < works.length - 1) onChange(works[idx + 1].slug);
  }, [idx, works, onChange]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, goPrev, goNext]);

  if (!work) return null;

  const credits = work.credits ?? [];
  const provider = work.embed_url ? providerFromUrl(work.embed_url) : null;
  const hasPrev = idx > 0;
  const hasNext = idx < works.length - 1;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/85 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 overflow-y-auto outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] duration-200"
        >
          <DialogPrimitive.Title className="sr-only">{work.title}</DialogPrimitive.Title>

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="fixed right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-surface/90 text-ink shadow-soft backdrop-blur transition hover:bg-surface md:right-6 md:top-6"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Prev / Next chevrons */}
          {hasPrev && (
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous Work"
              className="fixed left-2 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 text-ink shadow-soft backdrop-blur transition hover:bg-surface md:left-6 md:flex"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          {hasNext && (
            <button
              type="button"
              onClick={goNext}
              aria-label="Next Work"
              className="fixed right-2 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 text-ink shadow-soft backdrop-blur transition hover:bg-surface md:right-6 md:flex"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          <div className="mx-auto flex min-h-full max-w-5xl flex-col items-stretch gap-6 px-4 py-12 md:px-8 md:py-16">
            {/* Media */}
            <div className="overflow-hidden rounded-3xl bg-surface-2 shadow-lift">
              {work.embed_url ? (
                <EmbedPlayer url={work.embed_url} provider={provider} title={work.title} poster={work.cover_url} className="rounded-3xl border-0" />
              ) : work.cover_url ? (
                <img src={work.cover_url} alt={work.title} className="w-full object-contain" style={{ maxHeight: "70vh" }} />
              ) : (
                <div className="aspect-[4/5] w-full gradient-soft" />
              )}
            </div>

            {/* Meta */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <CategoryChip category={work.category} />
                {work.my_role && (
                  <span className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs text-ink-soft">
                    as {work.my_role}
                  </span>
                )}
              </div>

              <h2 className="font-display text-3xl text-ink md:text-4xl">{work.title}</h2>

              {credits.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-ink-muted">by</span>
                  <div className="flex flex-wrap items-center gap-3">
                    {credits.slice(0, 6).map((c, i) => {
                      const name = c.display_name || c.username || "Anon";
                      const node = (
                        <div className="inline-flex items-center gap-1.5">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={c.avatar_url ?? undefined} alt={name} />
                            <AvatarFallback className="text-[10px]">{name[0]}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-ink-soft">{name}</span>
                        </div>
                      );
                      if (c.id) {
                        return (
                          <ProfilePeek key={`${c.id}-${i}`} userId={c.id}>
                            <button type="button" className="cursor-pointer hover:opacity-80 transition">{node}</button>
                          </ProfilePeek>
                        );
                      }
                      return <span key={i}>{node}</span>;
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-4 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {work.like_count}</span>
                <span className="inline-flex items-center gap-1"><Bookmark className="h-3.5 w-3.5" /> {work.save_count}</span>
                <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {work.view_count}</span>
                <span className="ml-auto text-[11px]">
                  {idx + 1} / {works.length}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Link to="/works/$slug" params={{ slug: work.slug }} onClick={onClose}>
                  <Button className="rounded-full gap-1.5">
                    Open full page <ExternalLink className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Mobile prev/next */}
            <div className="flex items-center justify-between gap-2 pt-4 md:hidden">
              <Button variant="outline" className={cn("rounded-full gap-1.5", !hasPrev && "invisible")} onClick={goPrev}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <Button variant="outline" className={cn("rounded-full gap-1.5", !hasNext && "invisible")} onClick={goNext}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

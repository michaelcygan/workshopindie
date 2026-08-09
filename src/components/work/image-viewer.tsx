import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, X, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DerivedWorkAsset, WorkAsset } from "@/lib/work-assets";

type Asset = WorkAsset | DerivedWorkAsset;

/**
 * The universal image presentation for Work: paintings, photography, ceramics,
 * architectural drawings, process shots. It never needs to know which.
 */
export function ImageViewer({
  images,
  title,
  className,
}: {
  images: Asset[];
  title: string;
  className?: string;
}) {
  const [emblaRef, embla] = useEmblaCarousel({ loop: false, align: "center" });
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!embla) return;
    const onSelect = () => setIndex(embla.selectedScrollSnap());
    embla.on("select", onSelect);
    onSelect();
    return () => {
      embla.off("select", onSelect);
    };
  }, [embla]);

  const prev = useCallback(() => embla?.scrollPrev(), [embla]);
  const next = useCallback(() => embla?.scrollNext(), [embla]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
      if (e.key === "Escape") setZoomed(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next]);

  if (images.length === 0) return null;
  const multi = images.length > 1;
  const active = images[index];

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative overflow-hidden rounded-xl border border-border bg-surface-2">
        <div ref={emblaRef} className="overflow-hidden">
          <div className="flex touch-pan-y">
            {images.map((img, i) => (
              <div key={img.id} className="min-w-0 flex-[0_0_100%]">
                {failed[img.id] ? (
                  <div className="flex aspect-[4/3] items-center justify-center">
                    <a
                      href={img.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-sm text-ink-muted underline underline-offset-2"
                    >
                      Open image
                    </a>
                  </div>
                ) : (
                  <img
                    src={img.url}
                    alt={img.caption || img.label || `${title} — image ${i + 1} of ${images.length}`}
                    loading={i === 0 ? "eager" : "lazy"}
                    decoding="async"
                    onError={() => setFailed((f) => ({ ...f, [img.id]: true }))}
                    className="mx-auto max-h-[78vh] w-full object-contain"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setZoomed(true)}
          aria-label="View full screen"
          className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/85 text-ink shadow-soft hover:bg-background"
        >
          <Maximize2 className="h-4 w-4" />
        </button>

        {multi && (
          <>
            <NavButton side="left" onClick={prev} disabled={index === 0} />
            <NavButton side="right" onClick={next} disabled={index === images.length - 1} />
          </>
        )}
      </div>

      {(multi || active?.caption) && (
        <div className="flex items-center justify-between gap-3 text-sm text-ink-muted">
          <span className="min-w-0 truncate">{active?.caption || active?.label || ""}</span>
          {multi && (
            <span className="shrink-0 tabular-nums" aria-live="polite">
              {index + 1} / {images.length}
            </span>
          )}
        </div>
      )}

      {zoomed && active && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${title} — full screen image`}
          onClick={() => setZoomed(false)}
        >
          <img src={active.url} alt={active.caption || title} className="max-h-full max-w-full object-contain" />
          <button
            type="button"
            onClick={() => setZoomed(false)}
            aria-label="Close full screen"
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function NavButton({ side, onClick, disabled }: { side: "left" | "right"; onClick: () => void; disabled: boolean }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Previous image" : "Next image"}
      className={cn(
        "absolute top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-background/85 text-ink shadow-soft transition hover:bg-background disabled:opacity-30 sm:inline-flex",
        "h-9 w-9",
        side === "left" ? "left-2" : "right-2",
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

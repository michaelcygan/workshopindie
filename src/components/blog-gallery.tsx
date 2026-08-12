import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BlogGallery as BlogGalleryData } from "@/lib/blog-body-segments";

/**
 * The canonical inline blog gallery. Two dependency-free layouts:
 *
 * - `wall`     — responsive CSS grid mosaic (2 up on mobile, 3 up on desktop);
 *                the lead photo spans two columns when the count is uneven.
 * - `slideshow`— horizontal scroll-snap strip with arrows and dots.
 *
 * Clicking a photo asks the parent to open the shared lightbox, which already
 * supports next/prev, so both layouts get the full-screen slideshow.
 */
export function BlogGallery({
  gallery,
  onOpen,
  className,
  inert,
}: {
  gallery: BlogGalleryData;
  onOpen?: (index: number) => void;
  className?: string;
  /** Renders the gallery non-interactive (composer preview). */
  inert?: boolean;
}) {
  const items = gallery.items ?? [];
  if (items.length === 0) return null;

  return (
    <figure className={cn("my-8", className)}>
      {gallery.layout === "slideshow" ? (
        <GallerySlideshow gallery={gallery} onOpen={onOpen} inert={inert} />
      ) : (
        <GalleryWall gallery={gallery} onOpen={onOpen} inert={inert} />
      )}
      {gallery.caption && (
        <figcaption className="mx-auto mt-3 max-w-[46rem] text-center text-[13px] leading-snug text-ink-muted">
          {gallery.caption}
        </figcaption>
      )}
    </figure>
  );
}

const FRAME = "overflow-hidden rounded-2xl border border-border bg-muted/30";

function Photo({
  url,
  alt,
  index,
  onOpen,
  inert,
  className,
  imgClassName,
}: {
  url: string;
  alt?: string;
  index: number;
  onOpen?: (index: number) => void;
  inert?: boolean;
  className?: string;
  imgClassName?: string;
}) {
  const img = (
    <img
      src={url}
      alt={alt ?? ""}
      loading="lazy"
      className={cn("block h-full w-full object-cover", imgClassName)}
    />
  );
  if (inert || !onOpen) return <div className={cn(FRAME, className)}>{img}</div>;
  return (
    <button
      type="button"
      onClick={() => onOpen(index)}
      aria-label={alt ? `Open image: ${alt}` : `Open image ${index + 1}`}
      className={cn(FRAME, "block cursor-zoom-in transition hover:ring-2 hover:ring-primary/40", className)}
    >
      {img}
    </button>
  );
}

function GalleryWall({
  gallery,
  onOpen,
  inert,
}: {
  gallery: BlogGalleryData;
  onOpen?: (index: number) => void;
  inert?: boolean;
}) {
  const items = gallery.items;
  // An uneven count reads better with a wide lead photo.
  const leadWide = items.length % 3 === 1 && items.length > 3;
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
      {items.map((it, i) => (
        <Photo
          key={`${it.url}-${i}`}
          url={it.url}
          alt={it.alt}
          index={i}
          onOpen={onOpen}
          inert={inert}
          className={cn(
            "aspect-square",
            i === 0 && leadWide && "col-span-2 row-span-1 aspect-[2/1] md:aspect-[2/1]",
          )}
        />
      ))}
    </div>
  );
}

function GallerySlideshow({
  gallery,
  onOpen,
  inert,
}: {
  gallery: BlogGalleryData;
  onOpen?: (index: number) => void;
  inert?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const items = gallery.items;

  function scrollTo(i: number) {
    const el = trackRef.current;
    if (!el) return;
    const next = Math.min(Math.max(i, 0), items.length - 1);
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    setActive(next);
  }

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / Math.max(el.clientWidth, 1));
          if (i !== active) setActive(i);
        }}
        className="flex snap-x snap-mandatory gap-0 overflow-x-auto scroll-smooth rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((it, i) => (
          <div key={`${it.url}-${i}`} className="w-full shrink-0 snap-center">
            <Photo
              url={it.url}
              alt={it.alt}
              index={i}
              onOpen={onOpen}
              inert={inert}
              className="aspect-[16/10] w-full rounded-2xl"
            />
          </div>
        ))}
      </div>

      {items.length > 1 && !inert && (
        <>
          <button
            type="button"
            onClick={() => scrollTo(active - 1)}
            disabled={active === 0}
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/90 text-ink-soft shadow-sm transition hover:bg-background disabled:opacity-30 md:inline-flex"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollTo(active + 1)}
            disabled={active === items.length - 1}
            aria-label="Next photo"
            className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/90 text-ink-soft shadow-sm transition hover:bg-background disabled:opacity-30 md:inline-flex"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}

      {items.length > 1 && (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {items.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === active ? "w-4 bg-primary" : "w-1.5 bg-border",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import type { BlogImageMeta } from "@/lib/blog-body-segments";

/**
 * The canonical inline blog image: centered, constrained to the article
 * measure, with optional caption and credit underneath. Used by both the
 * public renderer and the composer so preview == published.
 *
 * Click behaviour:
 * - no `link` → the parent decides (usually opens the lightbox via `onOpen`)
 * - external `link` → new tab
 * - internal `link` (starts with "/") → client-side navigation
 */
export function BlogFigure({
  image,
  onOpen,
  className,
  inert,
}: {
  image: BlogImageMeta;
  onOpen?: () => void;
  className?: string;
  /** Renders the figure non-interactive (composer preview). */
  inert?: boolean;
}) {
  const { url, alt, caption, credit, link } = image;
  const img = (
    <img
      src={url}
      alt={alt ?? ""}
      loading="lazy"
      className="mx-auto block max-h-[80vh] w-full object-contain"
    />
  );

  const frame = "overflow-hidden rounded-2xl border border-border bg-muted/30";
  const internal = !!link && link.startsWith("/");

  let media: React.ReactNode;
  if (inert) {
    media = <div className={frame}>{img}</div>;
  } else if (link && internal) {
    media = (
      <Link to={link} className={cn(frame, "block transition hover:ring-2 hover:ring-primary/40")}>
        {img}
      </Link>
    );
  } else if (link) {
    media = (
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className={cn(frame, "block transition hover:ring-2 hover:ring-primary/40")}
      >
        {img}
      </a>
    );
  } else if (onOpen) {
    media = (
      <button
        type="button"
        onClick={onOpen}
        aria-label={alt ? `Open image: ${alt}` : "Open image"}
        className={cn(frame, "block w-full cursor-zoom-in transition hover:ring-2 hover:ring-primary/40")}
      >
        {img}
      </button>
    );
  } else {
    media = <div className={frame}>{img}</div>;
  }

  return (
    <figure className={cn("my-8 flex flex-col items-center", className)}>
      <div className="w-full">{media}</div>
      {(caption || credit) && (
        <figcaption className="mt-2 max-w-[46rem] text-center text-[13px] leading-snug text-ink-muted">
          {caption}
          {caption && credit && <span aria-hidden className="mx-1.5 opacity-50">·</span>}
          {credit && <span className="text-[12px] uppercase tracking-wide">{credit}</span>}
        </figcaption>
      )}
    </figure>
  );
}

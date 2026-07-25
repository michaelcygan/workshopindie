import { Link } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Editorial card — the shared homepage card language.
 *
 * Cover · uppercase eyebrow · display-serif title · one-line dek · optional chips.
 * Modeled on the Blog rail (which the user prefers over the busier Gallery card).
 *
 * Kept intentionally presentational. Feed data via props; wrap the whole card
 * in a Link/href to keep a single primary affordance.
 */
export type EditorialCardProps = {
  cover?: string | null;
  coverFallbackClass?: string;
  coverOverlay?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  dek?: ReactNode;
  chips?: ReactNode;
  meta?: ReactNode;
  href?: LinkProps["to"];
  hrefParams?: LinkProps["params"];
  hrefSearch?: LinkProps["search"];
  externalHref?: string;
  onClick?: () => void;
  className?: string;
  aspect?: "16/10" | "4/5" | "1/1";
  ariaLabel?: string;
};

export function EditorialCard(props: EditorialCardProps) {
  const {
    cover,
    coverFallbackClass = "gradient-soft",
    coverOverlay,
    eyebrow,
    title,
    dek,
    chips,
    meta,
    href,
    hrefParams,
    hrefSearch,
    externalHref,
    onClick,
    className,
    aspect = "16/10",
    ariaLabel,
  } = props;

  const aspectClass =
    aspect === "16/10" ? "aspect-[16/10]" : aspect === "4/5" ? "aspect-[4/5]" : "aspect-square";

  const body = (
    <>
      <div className={cn("relative w-full overflow-hidden bg-muted", aspectClass)}>
        {cover ? (
          <img
            src={cover}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
        ) : (
          <div className={cn("h-full w-full", coverFallbackClass)} />
        )}
        {coverOverlay ? (
          <div className="pointer-events-none absolute inset-0">{coverOverlay}</div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        {eyebrow ? (
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted">
            {eyebrow}
          </div>
        ) : null}
        <h3 className="font-display text-[19px] leading-[1.2] text-ink line-clamp-2 group-hover:text-primary transition-colors md:text-[21px]">
          {title}
        </h3>
        {dek ? <p className="text-sm text-ink-soft line-clamp-2">{dek}</p> : null}
        {chips ? <div className="mt-1 flex flex-wrap gap-1.5">{chips}</div> : null}
        {meta ? (
          <div className="mt-auto flex items-center gap-2 pt-2 text-[11px] text-ink-muted">
            {meta}
          </div>
        ) : null}
      </div>
    </>
  );

  const shell =
    "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift";

  const Motion = motion.div;
  const wrap = (inner: ReactNode) => (
    <Motion
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="h-full"
    >
      {inner}
    </Motion>
  );

  if (externalHref) {
    return wrap(
      <a
        href={externalHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={ariaLabel}
        className={cn(shell, className)}
      >
        {body}
      </a>,
    );
  }
  if (href) {
    return wrap(
      <Link
        to={href}
        params={hrefParams as never}
        search={hrefSearch as never}
        aria-label={ariaLabel}
        className={cn(shell, className)}
      >
        {body}
      </Link>,
    );
  }
  return wrap(
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(shell, "text-left", className)}
    >
      {body}
    </button>,
  );
}

/** Small pill chip used inside editorial cards. */
export function EditorialChip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "primary" | "coral";
}) {
  const cls =
    tone === "primary"
      ? "bg-primary/10 text-primary"
      : tone === "coral"
        ? "bg-coral/15 text-coral"
        : "bg-muted text-ink-soft";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", cls)}>
      {children}
    </span>
  );
}

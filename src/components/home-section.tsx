import { Link } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Unified section rhythm for the homepage. Every rail/section below the hero
 * wraps in <HomeSection> so the eyebrow, display title, dek, and CTA pill
 * always land in the same place — the "magazine" feel.
 *
 * Variants:
 *  - "default": full <section> with hairline top border + generous padding.
 *  - "bare":    just the header block, no wrapping section/padding (use when
 *               a parent already provides <section> padding — like blog rail).
 */
export function HomeSection({
  eyebrow,
  title,
  kicker,
  href,
  cta,
  children,
  className,
  divider = true,
  tone = "default",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  kicker?: ReactNode;
  href?: LinkProps["to"];
  cta?: string;
  children: ReactNode;
  className?: string;
  divider?: boolean;
  tone?: "default" | "quiet";
}) {
  return (
    <section
      className={cn(
        "mx-auto max-w-7xl px-4 md:px-6",
        tone === "quiet" ? "py-8 md:py-10" : "py-12 md:py-16",
        divider && "border-t border-border/60",
        className,
      )}
    >
      <HomeSectionHeader eyebrow={eyebrow} title={title} kicker={kicker} href={href} cta={cta} />
      <div className={cn(tone === "quiet" ? "mt-4" : "mt-8")}>{children}</div>
    </section>
  );
}

export function HomeSectionHeader({
  eyebrow,
  title,
  kicker,
  href,
  cta,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  kicker?: ReactNode;
  href?: LinkProps["to"];
  cta?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">
            {eyebrow}
          </div>
        ) : null}
        <h2 className="font-display text-3xl leading-[1.05] text-ink md:text-[40px]">
          {title}
        </h2>
        {kicker ? (
          <p className="mt-2 max-w-xl text-sm text-ink-muted md:text-[15px]">{kicker}</p>
        ) : null}
      </div>
      {href && cta ? (
        <Link
          to={href}
          className="group inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-muted hover:text-ink"
        >
          {cta}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : null}
    </div>
  );
}

/** Small dot separator for eyebrow strings. */
export function Dot() {
  return <span className="mx-1.5 text-ink-muted/50">·</span>;
}

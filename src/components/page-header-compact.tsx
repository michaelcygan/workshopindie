import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  /** Where the back chip should link. Defaults to "/". Omit to hide the chip. */
  backTo?: string | null;
  backLabel?: string;
  right?: React.ReactNode;
  className?: string;
};

/**
 * One-line header: back chip + serif title + right slot.
 * Mirrors the `/workshop` entry-flow header.
 */
export function PageHeaderCompact({
  title,
  backTo = "/",
  backLabel = "Home",
  right,
  className,
}: Props) {
  return (
    <header className={cn("flex items-center justify-between gap-4", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {backTo && (
          <Link
            to={backTo}
            aria-label={backLabel}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition hover:bg-muted/40 hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        )}
        <h1 className="truncate font-display text-2xl leading-none text-ink md:text-[28px]">
          {title}
        </h1>
      </div>
      {right && <div className="flex shrink-0 items-center gap-3">{right}</div>}
    </header>
  );
}

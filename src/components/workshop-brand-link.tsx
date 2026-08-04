import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/**
 * The single source of truth for the Workshop brand link (mark + wordmark).
 * Shared by the desktop TopNav and the MobileBrandHeader so the two can't drift.
 */
export function WorkshopBrandLink({
  size = "default",
  className,
}: {
  size?: "default" | "compact";
  className?: string;
}) {
  const compact = size === "compact";
  const px = compact ? 24 : 28;

  return (
    <Link
      to="/"
      aria-label="Workshop home"
      className={cn(
        "group inline-flex shrink-0 items-center whitespace-nowrap rounded-full transition hover:bg-muted",
        compact ? "gap-[7px] px-2 py-1" : "gap-2 px-2 py-1.5",
        className,
      )}
    >
      <img
        src="/brand/workshop-logo-mark.svg"
        alt=""
        aria-hidden
        width={px}
        height={px}
        className={cn(
          "shrink-0 object-contain dark:invert",
          compact ? "h-6 w-6" : "h-7 w-7",
        )}
      />
      <span
        className={cn(
          "font-display leading-none tracking-tight text-ink",
          compact ? "text-base" : "text-lg",
        )}
      >
        Workshop
      </span>
    </Link>
  );
}

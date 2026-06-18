import { cn } from "@/lib/utils";

type Props = {
  live?: boolean;
  className?: string;
  size?: "xs" | "sm";
};

/** Tiny pulsing gradient dot — used inline next to counts/labels. */
export function LiveDot({ live, className, size = "sm" }: Props) {
  const px = size === "xs" ? "h-1.5 w-1.5" : "h-2 w-2";
  return (
    <span className={cn("relative inline-flex", px, className)}>
      {live && (
        <span className="gradient-motion absolute inset-0 animate-ping rounded-full opacity-70" />
      )}
      <span
        className={cn(
          "relative inline-flex rounded-full",
          px,
          live ? "gradient-motion" : "border border-ink/20",
        )}
      />
    </span>
  );
}

import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  live?: boolean;
  className?: string;
};

/** Small uppercase eyebrow chip with optional live pulsing dot. */
export function KickerChip({ children, live, className }: Props) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-primary",
        className,
      )}
    >
      <span className="relative inline-flex h-1.5 w-1.5">
        {live && (
          <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-70" />
        )}
        <span
          className={cn(
            "relative inline-flex h-1.5 w-1.5 rounded-full",
            live ? "bg-primary" : "bg-primary/40",
          )}
        />
      </span>
      <span>{children}</span>
    </div>
  );
}

import { cn } from "@/lib/utils";

type Tone = "open" | "closed";

const TONE: Record<Tone, { dot: string; text: string; bg: string }> = {
  open: {
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  closed: {
    dot: "bg-ink-soft",
    text: "text-ink-soft",
    bg: "bg-muted border-border",
  },
};

/**
 * Small status pill used across the Collab surface.
 * Users only ever see "Open" or "Closed" — sublabel does the nuance
 * (Casting / Closing soon / Shipped / Archived).
 */
export function StateBadge({
  tone,
  label,
  sublabel,
  className,
}: {
  tone: Tone;
  label: string;
  sublabel?: string;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        t.bg,
        t.text,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", t.dot)} />
      <span>{label}</span>
      {sublabel && (
        <>
          <span className="opacity-50">·</span>
          <span className="font-normal opacity-80">{sublabel}</span>
        </>
      )}
    </span>
  );
}

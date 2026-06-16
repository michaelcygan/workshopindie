import { useMemo } from "react";
import { ROOM_PROMPTS, shuffle, type RoomPrompt } from "@/lib/topic-prompts";
import { cn } from "@/lib/utils";

type Props = {
  onUsePrompt: (prompt: RoomPrompt) => void;
  disabled?: boolean;
  /** How many prompts to surface per row. Default 12 per row × 2 rows. */
  perRow?: number;
};

/**
 * Two opposing slow-scrolling rows of clickable room-name prompts.
 * Tapping a chip pre-fills the host dialog with that title + medium.
 * Respects prefers-reduced-motion (CSS handles freeze).
 */
export function RoomPromptMarquee({ onUsePrompt, disabled, perRow = 12 }: Props) {
  const { rowA, rowB } = useMemo(() => {
    const pool = shuffle(ROOM_PROMPTS);
    const a = pool.slice(0, perRow);
    const b = pool.slice(perRow, perRow * 2);
    // Fall back to filling row B from start if pool is short
    return { rowA: a, rowB: b.length >= perRow / 2 ? b : pool.slice(0, perRow) };
  }, [perRow]);

  return (
    <div
      aria-label="Suggested rooms"
      className="relative mt-5 overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
      }}
    >
      <MarqueeRow prompts={rowA} onUsePrompt={onUsePrompt} disabled={disabled} />
      <div className="h-1.5" />
      <MarqueeRow prompts={rowB} onUsePrompt={onUsePrompt} disabled={disabled} reverse />
    </div>
  );
}

function MarqueeRow({
  prompts,
  onUsePrompt,
  disabled,
  reverse,
}: {
  prompts: RoomPrompt[];
  onUsePrompt: (p: RoomPrompt) => void;
  disabled?: boolean;
  reverse?: boolean;
}) {
  // Duplicate the list so translateX(-50%) loops seamlessly.
  const items = [...prompts, ...prompts];
  return (
    <div className="flex w-max gap-1.5">
      <div
        className={cn(
          "flex gap-1.5 will-change-transform",
          reverse ? "animate-marquee-x-reverse" : "animate-marquee-x",
        )}
      >
        {items.map((p, i) => (
          <PromptChip
            key={`${p.title}-${i}`}
            prompt={p}
            onClick={() => !disabled && onUsePrompt(p)}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

function PromptChip({
  prompt,
  onClick,
  disabled,
}: {
  prompt: RoomPrompt;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={`Spin up: ${prompt.title}`}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full border border-border/70 bg-surface",
        "px-3 py-1.5 text-[11.5px] text-ink-soft transition",
        "hover:border-ink/40 hover:text-ink hover:bg-muted/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
        "disabled:opacity-60",
      )}
    >
      {prompt.title}
    </button>
  );
}

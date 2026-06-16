import { useMemo, useState, type CSSProperties } from "react";
import { Sparkles } from "lucide-react";
import { ROOM_PROMPTS, shuffle, type RoomPrompt } from "@/lib/topic-prompts";
import { CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Props = {
  onUsePrompt: (prompt: RoomPrompt) => void;
  disabled?: boolean;
  /** How many prompts per row. Default 10 × 3 rows. */
  perRow?: number;
};

type RowSpec = { items: RoomPrompt[]; reverse: boolean; durationMs: number };

/**
 * Three stacked, slow, opposing marquee rows of clickable room-name prompts.
 * Clicking a chip opens a small confirm popover; "Start now" pre-fills the
 * host dialog (via onUsePrompt) with that title + medium.
 */
export function RoomPromptMarquee({ onUsePrompt, disabled, perRow = 10 }: Props) {
  const rows = useMemo<RowSpec[]>(() => {
    const pool = shuffle(ROOM_PROMPTS);
    const slice = (start: number) => {
      const window = pool.slice(start, start + perRow);
      return window.length >= Math.ceil(perRow / 2)
        ? window
        : shuffle(pool).slice(0, perRow);
    };
    return [
      { items: slice(0),           reverse: false, durationMs: 58000 },
      { items: slice(perRow),      reverse: true,  durationMs: 64000 },
      { items: slice(perRow * 2),  reverse: false, durationMs: 52000 },
    ];
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
      {rows.map((row, i) => (
        <div key={i} className={i === 0 ? "" : "mt-1.5"}>
          <MarqueeRow
            prompts={row.items}
            onUsePrompt={onUsePrompt}
            disabled={disabled}
            reverse={row.reverse}
            durationMs={row.durationMs}
          />
        </div>
      ))}
    </div>
  );
}

function MarqueeRow({
  prompts,
  onUsePrompt,
  disabled,
  reverse,
  durationMs,
}: {
  prompts: RoomPrompt[];
  onUsePrompt: (p: RoomPrompt) => void;
  disabled?: boolean;
  reverse?: boolean;
  durationMs: number;
}) {
  // Duplicate so translateX(-50%) loops seamlessly.
  const items = [...prompts, ...prompts];
  const style = { "--marquee-duration": `${durationMs}ms` } as CSSProperties;
  return (
    <div className="flex w-max gap-1.5">
      <div
        style={style}
        className={cn(
          "flex gap-1.5 will-change-transform",
          reverse ? "animate-marquee-x-reverse" : "animate-marquee-x",
        )}
      >
        {items.map((p, i) => (
          <PromptChip
            key={`${p.title}-${i}`}
            prompt={p}
            onConfirm={() => !disabled && onUsePrompt(p)}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

function PromptChip({
  prompt,
  onConfirm,
  disabled,
}: {
  prompt: RoomPrompt;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const mediumLabel = prompt.medium
    ? CATEGORIES.find((c) => c.id === prompt.medium)?.label ?? prompt.medium
    : "Open topic";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          title={`Open: ${prompt.title}`}
          className={cn(
            "shrink-0 whitespace-nowrap rounded-full border border-border/70 bg-surface",
            "px-3 py-1.5 text-[11.5px] text-ink-soft transition",
            "hover:border-ink/40 hover:text-ink hover:bg-muted/40",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
            "disabled:opacity-60",
            open && "border-ink/40 text-ink bg-muted/40",
          )}
        >
          {prompt.title}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={8}
        className="w-64 p-3"
      >
        <div className="text-[11px] uppercase tracking-wide text-ink-muted">
          {mediumLabel} · workshop
        </div>
        <div className="mt-1 text-sm font-medium leading-snug text-ink">
          {prompt.title}
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={disabled}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
            disabled={disabled}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Start now
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

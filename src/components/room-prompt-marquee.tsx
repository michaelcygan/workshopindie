import { useMemo, useRef, useState, type CSSProperties } from "react";
import { Sparkles, Users } from "lucide-react";
import {
  ROOM_PROMPTS,
  dealPromptRows,
  type RoomPrompt,
} from "@/lib/topic-prompts";
import { CATEGORIES, type Category } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Props = {
  onUsePrompt: (prompt: RoomPrompt) => void;
  /** If a medium has live rooms, the popover offers "Join a live one". */
  onJoinLive?: (medium: Category) => void;
  /** Live count per medium, used to surface "Join live" affordance. */
  liveByMedium?: Map<Category, number>;
  disabled?: boolean;
  /** Prompts per row. Default 14. */
  perRow?: number;
  /** Visible rows. Default 4 (responsive). Use 2 for mobile-only contexts. */
  maxRows?: 2 | 3 | 4;
  /** "marquee" = animated rows (desktop); "static-row" = single mobile scroll row. */
  variant?: "marquee" | "static-row";
};

const MOBILE_QUICK_START_TITLES = [
  "Heads-down work session",
  "Portfolio review",
  "Mix feedback — bring stems",
  "Co-writing sprint",
  "Pair-program on a bug",
  "Dailies critique",
];


const ROW_DURATIONS_MS = [130_000, 145_000, 118_000, 135_000];

/**
 * Stacked, slow, opposing marquee rows of clickable room-name prompts.
 * Responsive: 2 rows on mobile, 3 on tablet, 4 on desktop.
 * Clicking a chip opens a small confirm popover with up to 3 actions:
 *   Join live (N) · Start now · Cancel
 */
export function RoomPromptMarquee({
  onUsePrompt,
  onJoinLive,
  liveByMedium,
  disabled,
  perRow = 14,
  maxRows = 4,
  variant = "marquee",
}: Props) {
  if (variant === "static-row") {
    const picks = MOBILE_QUICK_START_TITLES
      .map((t) => ROOM_PROMPTS.find((p) => p.title === t))
      .filter((p): p is RoomPrompt => Boolean(p));
    return (
      <div className="px-4 py-3">
        <div className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-muted/70">
          Quick starts
        </div>
        <div className="-mx-4 px-4 flex gap-2 overflow-x-auto snap-x scrollbar-none pb-1">
          {picks.map((p) => (
            <div key={p.title} className="snap-start shrink-0">
              <PromptChip
                prompt={p}
                liveCount={p.medium ? liveByMedium?.get(p.medium) ?? 0 : 0}
                onConfirm={() => !disabled && onUsePrompt(p)}
                onJoinLive={
                  p.medium && onJoinLive
                    ? () => !disabled && onJoinLive(p.medium as Category)
                    : undefined
                }
                disabled={disabled}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }


  // Stable per-mount shuffle (so HMR / re-renders don't reshuffle).
  const rowsRef = useRef<RoomPrompt[][] | null>(null);
  if (!rowsRef.current) {
    rowsRef.current = dealPromptRows(ROOM_PROMPTS, maxRows, perRow);
  }
  const rows = rowsRef.current;

  return (
    <div
      aria-label="Suggested rooms — click to start or join"
      className={cn(
        "group/marquee relative mt-5",
        "overflow-x-hidden hover:overflow-x-auto focus-within:overflow-x-auto",
        "overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      )}
      style={{
        maskImage:
          "linear-gradient(to right, transparent, black 14%, black 86%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 14%, black 86%, transparent)",
      }}
    >

      {rows.map((items, i) => {
        // Row 1 always visible; row 2 ≥ sm; row 3 ≥ md; row 4 ≥ lg.
        const visibility =
          i === 0
            ? ""
            : i === 1
              ? "hidden sm:block"
              : i === 2
                ? "hidden md:block"
                : "hidden lg:block";
        return (
          <div key={i} className={cn(i === 0 ? "" : "mt-1.5", visibility)}>
            <MarqueeRow
              prompts={items}
              onUsePrompt={onUsePrompt}
              onJoinLive={onJoinLive}
              liveByMedium={liveByMedium}
              disabled={disabled}
              reverse={i % 2 === 1}
              durationMs={ROW_DURATIONS_MS[i] ?? 110_000}
            />
          </div>
        );
      })}
    </div>
  );
}

function MarqueeRow({
  prompts,
  onUsePrompt,
  onJoinLive,
  liveByMedium,
  disabled,
  reverse,
  durationMs,
}: {
  prompts: RoomPrompt[];
  onUsePrompt: (p: RoomPrompt) => void;
  onJoinLive?: (medium: Category) => void;
  liveByMedium?: Map<Category, number>;
  disabled?: boolean;
  reverse?: boolean;
  durationMs: number;
}) {
  // Duplicate so translateX(-50%) loops seamlessly.
  const items = [...prompts, ...prompts];
  const style = { "--marquee-duration": `${durationMs}ms` } as CSSProperties;
  return (
    <div className="marquee-row flex w-max gap-1.5">
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
            liveCount={p.medium ? liveByMedium?.get(p.medium) ?? 0 : 0}
            onConfirm={() => !disabled && onUsePrompt(p)}
            onJoinLive={
              p.medium && onJoinLive
                ? () => !disabled && onJoinLive(p.medium as Category)
                : undefined
            }
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

function PromptChip({
  prompt,
  liveCount,
  onConfirm,
  onJoinLive,
  disabled,
  size = "sm",
}: {
  prompt: RoomPrompt;
  liveCount: number;
  onConfirm: () => void;
  onJoinLive?: () => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const mediumLabel = prompt.medium
    ? CATEGORIES.find((c) => c.id === prompt.medium)?.label ?? prompt.medium
    : "Open topic";
  const hasLive = liveCount > 0 && !!onJoinLive;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          title={`Open: ${prompt.title}`}
          className={cn(
            "relative shrink-0 whitespace-nowrap rounded-full border border-border/70 bg-surface",
            size === "md"
              ? "min-h-11 px-4 py-2.5 text-[13px]"
              : "px-3 py-1.5 text-[11.5px]",
            "text-ink-soft transition",
            "hover:border-ink/40 hover:text-ink hover:bg-muted/40",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
            "disabled:opacity-60",
            open && "border-ink/40 text-ink bg-muted/40",
            hasLive && "border-primary/40",
          )}
        >

          {hasLive && (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 inline-flex h-1.5 w-1.5 rounded-full bg-primary"
            />
          )}
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
        <div className="mt-3 flex flex-col gap-1.5">
          {hasLive && (
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-center gap-1.5"
              onClick={() => {
                setOpen(false);
                onJoinLive!();
              }}
              disabled={disabled}
            >
              <Users className="h-3.5 w-3.5" />
              Join a live one ({liveCount})
            </Button>
          )}
          <div className="flex items-center justify-end gap-2">
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
        </div>
      </PopoverContent>
    </Popover>
  );
}

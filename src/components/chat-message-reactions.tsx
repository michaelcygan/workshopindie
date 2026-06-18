import { useState } from "react";
import { Smile, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type ReactionRow = {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
};

export const QUICK_EMOJI = ["👍", "❤️", "😂", "🎉", "🔥", "👀"] as const;
const PICKER_EMOJI = [
  "👍", "❤️", "😂", "🎉", "🔥", "👀", "🙌", "👏", "💯", "✨",
  "🤝", "🙏", "🤔", "😮", "😢", "💪", "👌", "🚀", "⭐", "✅",
];

/**
 * Quick-react bar shown on hover (or via the +/smiley trigger).
 * Calls `onToggle(emoji)` — parent owns insert/delete on
 * `instant_message_reactions`.
 */
export function ReactionAddButton({
  onToggle,
  tone = "light",
}: {
  onToggle: (emoji: string) => void;
  tone?: "light" | "dark";
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Add reaction"
          className={cn(
            "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs opacity-0 transition group-hover:opacity-100",
            tone === "dark"
              ? "bg-background/15 text-background hover:bg-background/25"
              : "bg-muted text-ink-muted hover:bg-muted/80",
          )}
        >
          <Smile className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-auto max-w-[260px] p-2"
        sideOffset={6}
      >
        <div className="grid grid-cols-6 gap-1">
          {QUICK_EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                onToggle(e);
                setOpen(false);
              }}
              className="rounded-md p-1.5 text-lg hover:bg-muted"
            >
              {e}
            </button>
          ))}
        </div>
        <div className="mt-1 border-t border-border pt-1 grid grid-cols-6 gap-1 max-h-40 overflow-y-auto">
          {PICKER_EMOJI.filter((e) => !QUICK_EMOJI.includes(e as any)).map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                onToggle(e);
                setOpen(false);
              }}
              className="rounded-md p-1.5 text-lg hover:bg-muted"
            >
              {e}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Renders existing reaction pills under a message. */
export function ReactionPills({
  reactions,
  meUserId,
  onToggle,
  tone = "light",
}: {
  reactions: ReactionRow[];
  meUserId: string | undefined;
  onToggle: (emoji: string) => void;
  tone?: "light" | "dark";
}) {
  if (reactions.length === 0) return null;
  const grouped = new Map<string, ReactionRow[]>();
  for (const r of reactions) {
    const list = grouped.get(r.emoji) ?? [];
    list.push(r);
    grouped.set(r.emoji, list);
  }
  const entries = Array.from(grouped.entries()).sort((a, b) => b[1].length - a[1].length);
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {entries.map(([emoji, rows]) => {
        const mine = !!meUserId && rows.some((r) => r.user_id === meUserId);
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onToggle(emoji)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] leading-none transition",
              mine
                ? tone === "dark"
                  ? "border-primary/60 bg-primary/20 text-background"
                  : "border-primary/60 bg-primary/15 text-primary"
                : tone === "dark"
                  ? "border-background/20 bg-background/10 text-background hover:bg-background/20"
                  : "border-border bg-muted/60 text-ink hover:bg-muted",
            )}
          >
            <span className="text-sm leading-none">{emoji}</span>
            <span className="tabular-nums">{rows.length}</span>
          </button>
        );
      })}
    </div>
  );
}

export const ReactionIcons = { Plus };

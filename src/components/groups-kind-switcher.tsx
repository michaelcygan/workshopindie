import { cn } from "@/lib/utils";

export type KindTab = "all" | "for-you" | "genre" | "scene" | "micro" | "city";

type Item = { id: KindTab; label: string; authOnly?: boolean };

const ITEMS: readonly Item[] = [
  { id: "all", label: "All" },
  { id: "for-you", label: "Your groups", authOnly: true },
  { id: "genre", label: "Genres" },
  { id: "scene", label: "Scenes" },
  { id: "micro", label: "Micro" },
  { id: "city", label: "Cities" },
] as const;

type Props = {
  value: KindTab;
  counts: Record<KindTab, number>;
  authenticated: boolean;
  onChange: (value: KindTab) => void;
  className?: string;
};

/**
 * Single unified taxonomy switcher for /groups.
 * - One clean row on desktop; horizontal-scroll with snap on mobile.
 * - Counts live next to labels, subordinate typography.
 * - `for-you` is only shown to authenticated users; labelled "Your groups"
 *   because the behavior is membership filtering, not recommendations.
 */
export function GroupsKindSwitcher({ value, counts, authenticated, onChange, className }: Props) {
  const items = ITEMS.filter((i) => (i.authOnly ? authenticated : true));
  return (
    <div
      role="tablist"
      aria-label="Group kind"
      className={cn(
        "-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:overflow-visible md:px-0",
        "snap-x snap-mandatory md:snap-none",
        className,
      )}
    >
      {items.map((item) => {
        const active = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-pressed={active}
            onClick={() => onChange(item.id)}
            className={cn(
              "group inline-flex shrink-0 snap-start items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30",
              active
                ? "bg-ink text-background"
                : "border border-border bg-surface text-ink-soft hover:bg-muted",
            )}
          >
            <span>{item.label}</span>
            <span
              className={cn(
                "text-[11px] tabular-nums",
                active ? "text-background/70" : "text-ink-muted",
              )}
            >
              {counts[item.id] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}

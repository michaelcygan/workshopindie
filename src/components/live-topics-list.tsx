import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Loader2, Radio, Sparkles } from "lucide-react";
import { listActiveInstantRooms } from "@/lib/instant.functions";
import { CATEGORIES, type Category } from "@/lib/categories";
import { cn } from "@/lib/utils";

type Props = {
  /** Currently busy row (medium id or "any") so we can show a spinner. */
  busyKey?: string | null;
  /** Tap handler. `medium` null means "Any topic" matchmaker drop. */
  onPick: (medium: Category | null) => void;
  /** Reports total live count up to parent. */
  onLiveCountChange?: (n: number) => void;
  /** Disable all rows (e.g. no mic/cam). */
  disabled?: boolean;
};

/**
 * A flat, scannable list of topics with live counts. Tap any row to enter —
 * live rooms send you to a seat, empty topics open the first room.
 */
export function LiveTopicsList({ busyKey, onPick, onLiveCountChange, disabled }: Props) {
  const fetchRooms = useServerFn(listActiveInstantRooms);
  const [showAll, setShowAll] = useState(false);

  const { data } = useQuery({
    queryKey: ["instant-active-rooms"],
    queryFn: () => fetchRooms(),
    refetchInterval: 5000,
  });

  const rooms = data?.rooms ?? [];
  const liveCount = rooms.reduce((acc, r) => acc + r.live_count, 0);

  useEffect(() => {
    onLiveCountChange?.(liveCount);
  }, [liveCount, onLiveCountChange]);

  const liveByMedium = useMemo(() => {
    const m = new Map<Category, number>();
    for (const r of rooms) {
      if (r.medium) m.set(r.medium as Category, (m.get(r.medium as Category) ?? 0) + r.live_count);
    }
    return m;
  }, [rooms]);

  // Any-topic count = rooms with no medium specified (matchmaker pool)
  const anyCount = useMemo(
    () => rooms.filter((r) => !r.medium).reduce((a, r) => a + r.live_count, 0),
    [rooms],
  );

  // Sort: live first (by count desc), then empty topics
  const sorted = useMemo(() => {
    return [...CATEGORIES].sort((a, b) => {
      const la = liveByMedium.get(a.id) ?? 0;
      const lb = liveByMedium.get(b.id) ?? 0;
      if (la !== lb) return lb - la;
      return 0;
    });
  }, [liveByMedium]);

  const visibleCount = showAll ? sorted.length : 4;
  const visible = sorted.slice(0, visibleCount);
  const hiddenLive = sorted.slice(visibleCount).reduce((a, c) => a + (liveByMedium.get(c.id) ?? 0), 0);

  return (
    <div className="rounded-3xl border border-border bg-surface shadow-soft overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="text-xs uppercase tracking-wide text-ink-muted">Live now</div>
        <div className="text-xs text-ink-muted tabular-nums">{liveCount} in rooms</div>
      </div>

      <ul className="divide-y divide-border">
        <TopicRow
          label="Any topic"
          sublabel="Matchmaker picks the best open seat"
          live={anyCount}
          icon={<Sparkles className="h-4 w-4" />}
          highlight
          busy={busyKey === "any"}
          disabled={disabled}
          onClick={() => onPick(null)}
        />
        <AnimatePresence initial={false}>
          {visible.map((c) => {
            const live = liveByMedium.get(c.id) ?? 0;
            return (
              <motion.li
                key={c.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
              >
                <TopicRow
                  label={c.label}
                  live={live}
                  busy={busyKey === c.id}
                  disabled={disabled}
                  onClick={() => onPick(c.id)}
                />
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      {sorted.length > 4 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-border px-5 py-3 text-xs text-ink-muted hover:bg-muted/40 hover:text-ink transition"
        >
          <motion.span animate={{ rotate: showAll ? 180 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 22 }} className="inline-flex">
            <ChevronDown className="h-3.5 w-3.5" />
          </motion.span>
          {showAll
            ? "Show fewer topics"
            : hiddenLive > 0
              ? `See all topics · ${hiddenLive} more live`
              : "See all topics"}
        </button>
      )}
    </div>
  );
}

function TopicRow({
  label,
  sublabel,
  live,
  icon,
  highlight,
  busy,
  disabled,
  onClick,
}: {
  label: string;
  sublabel?: string;
  live: number;
  icon?: React.ReactNode;
  highlight?: boolean;
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const isLive = live > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className={cn(
        "group flex w-full items-center gap-3 px-5 py-3.5 text-left transition",
        "hover:bg-muted/40 disabled:opacity-60 disabled:hover:bg-transparent",
        highlight && "bg-muted/30",
      )}
    >
      <span className="relative inline-flex h-2 w-2 shrink-0">
        {isLive ? (
          <>
            <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </>
        ) : (
          <span className="inline-flex h-2 w-2 rounded-full border border-ink/20" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-sm font-medium text-ink">
          {icon}
          {label}
          {isLive && (
            <span className="text-xs font-normal text-ink-muted tabular-nums">· {live} live</span>
          )}
        </div>
        {sublabel && <div className="mt-0.5 text-xs text-ink-muted">{sublabel}</div>}
      </div>

      <span
        className={cn(
          "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
          isLive
            ? "bg-ink text-background group-hover:opacity-90"
            : "border border-dashed border-ink/25 text-ink-muted group-hover:border-ink/50 group-hover:text-ink",
        )}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isLive ? (
          "Take a seat"
        ) : (
          "Open first room"
        )}
      </span>
    </button>
  );
}

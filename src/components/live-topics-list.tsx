import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Loader2, Plus, Sparkles } from "lucide-react";
import { listActiveInstantRooms, type ActiveInstantRoom } from "@/lib/instant.functions";
import { CATEGORIES, type Category } from "@/lib/categories";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type Props = {
  busyKey?: string | null;
  onPick: (medium: Category | null) => void;
  onLiveCountChange?: (n: number) => void;
  disabled?: boolean;
  /** "stack" = single column (mobile default), "split" = featured Any + topic grid (desktop). */
  layout?: "stack" | "split";
};

export function LiveTopicsList({
  busyKey,
  onPick,
  onLiveCountChange,
  disabled,
  layout = "stack",
}: Props) {
  const fetchRooms = useServerFn(listActiveInstantRooms);
  const [showAll, setShowAll] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

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

  const anyCount = useMemo(
    () => rooms.filter((r) => !r.medium).reduce((a, r) => a + r.live_count, 0),
    [rooms],
  );

  const sorted = useMemo(() => {
    return [...CATEGORIES].sort((a, b) => {
      const la = liveByMedium.get(a.id) ?? 0;
      const lb = liveByMedium.get(b.id) ?? 0;
      if (la !== lb) return lb - la;
      return 0;
    });
  }, [liveByMedium]);

  const defaultVisible = layout === "split" ? 6 : 5;
  const visibleCount = showAll ? sorted.length : defaultVisible;
  const visible = sorted.slice(0, visibleCount);
  const hiddenLive = sorted
    .slice(visibleCount)
    .reduce((a, c) => a + (liveByMedium.get(c.id) ?? 0), 0);

  // Arrow-key navigation between rows
  function handleListKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const buttons = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>("button[data-row]") ?? [],
    );
    const idx = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (idx === -1) return;
    e.preventDefault();
    const next = e.key === "ArrowDown" ? (idx + 1) % buttons.length : (idx - 1 + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }

  const noneLive = liveCount === 0;

  if (layout === "split") {
    return (
      <div
        ref={listRef}
        onKeyDown={handleListKeyDown}
        className="rounded-2xl border border-border/70 bg-surface shadow-soft overflow-hidden grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]"
      >
        {/* Featured: Any topic */}
        <button
          type="button"
          data-row
          onClick={() => onPick(null)}
          disabled={disabled || busyKey === "any"}
          className={cn(
            "group relative text-left p-5 md:p-6 transition",
            "bg-gradient-to-br from-muted/40 via-muted/20 to-transparent",
            "hover:bg-muted/50 disabled:opacity-60",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
            "md:border-r border-border/70 border-b md:border-b-0",
          )}
        >
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-ink-muted">
            <Sparkles className="h-3 w-3" />
            {noneLive ? "Start the night" : "Matchmaker"}
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <div className="font-display text-2xl md:text-[28px] leading-none text-ink">
              Any topic
            </div>
            {anyCount > 0 && (
              <div className="text-xs text-ink-muted tabular-nums">· {anyCount} live</div>
            )}
          </div>
          <p className="mt-2 text-sm text-ink-muted max-w-xs">
            {noneLive
              ? "Be the first in tonight. We'll open a room for you."
              : "We'll drop you in the best open seat right now."}
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink text-background px-4 py-2 text-xs font-medium group-hover:opacity-90 transition">
            {busyKey === "any" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                {noneLive ? "Open the first room" : "Take a seat"}
                <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
              </>
            )}
          </div>
        </button>

        {/* Topics column */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
            <div className="text-[11px] uppercase tracking-wider text-ink-muted">By topic</div>
            <div className="text-[11px] text-ink-muted tabular-nums">
              {liveCount} {liveCount === 1 ? "person" : "people"} live
            </div>
          </div>
          <ul className="divide-y divide-border/60 flex-1">
            <AnimatePresence initial={false}>
              {visible.map((c) => {
                const live = liveByMedium.get(c.id) ?? 0;
                return (
                  <motion.li
                    key={c.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                  >
                    <TopicRow
                      label={c.label}
                      live={live}
                      busy={busyKey === c.id}
                      disabled={disabled}
                      dense
                      onClick={() => onPick(c.id)}
                    />
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
          {sorted.length > defaultVisible && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="flex w-full items-center justify-center gap-1.5 border-t border-border/60 px-4 py-2 text-[11px] text-ink-muted hover:bg-muted/40 hover:text-ink transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20"
            >
              <motion.span
                animate={{ rotate: showAll ? 180 : 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className="inline-flex"
              >
                <ChevronDown className="h-3 w-3" />
              </motion.span>
              {showAll
                ? "Fewer"
                : hiddenLive > 0
                  ? `${sorted.length - defaultVisible} more · ${hiddenLive} live`
                  : `${sorted.length - defaultVisible} more topics`}
            </button>
          )}
        </div>
      </div>
    );
  }

  // stack layout (mobile fallback)
  return (
    <div
      ref={listRef}
      onKeyDown={handleListKeyDown}
      className="rounded-2xl border border-border/70 bg-surface shadow-soft overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
        <div className="text-[11px] uppercase tracking-wider text-ink-muted">Live now</div>
        <div className="text-[11px] text-ink-muted tabular-nums">{liveCount} in rooms</div>
      </div>
      <ul className="divide-y divide-border/60">
        <TopicRow
          label="Any topic"
          sublabel={noneLive ? "Be the first in tonight" : "Matchmaker picks the best open seat"}
          live={anyCount}
          icon={<Sparkles className="h-4 w-4" />}
          highlight
          busy={busyKey === "any"}
          disabled={disabled}
          onClick={() => onPick(null)}
          forceLiveCTA={noneLive ? "Open the first room" : undefined}
        />
        <AnimatePresence initial={false}>
          {visible.map((c) => {
            const live = liveByMedium.get(c.id) ?? 0;
            return (
              <motion.li
                key={c.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
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
      {sorted.length > defaultVisible && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-border/60 px-4 py-2.5 text-xs text-ink-muted hover:bg-muted/40 hover:text-ink transition"
        >
          <motion.span
            animate={{ rotate: showAll ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            className="inline-flex"
          >
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
  dense,
  forceLiveCTA,
}: {
  label: string;
  sublabel?: string;
  live: number;
  icon?: React.ReactNode;
  highlight?: boolean;
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
  dense?: boolean;
  forceLiveCTA?: string;
}) {
  const isLive = live > 0;
  return (
    <button
      type="button"
      data-row
      onClick={onClick}
      disabled={disabled || busy}
      className={cn(
        "group flex w-full items-center gap-3 text-left transition",
        dense ? "px-4 py-2.5" : "px-5 py-3.5",
        "hover:bg-muted/40 disabled:opacity-60 disabled:hover:bg-transparent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink/20",
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
        <div className={cn("flex items-center gap-1.5 font-medium text-ink", dense ? "text-[13px]" : "text-sm")}>
          {icon}
          <span className="truncate">{label}</span>
          {isLive && (
            <span className="text-[11px] font-normal text-ink-muted tabular-nums">· {live}</span>
          )}
        </div>
        {sublabel && <div className="mt-0.5 text-xs text-ink-muted">{sublabel}</div>}
      </div>

      <span
        className={cn(
          "shrink-0 rounded-full text-[11px] font-medium transition tabular-nums",
          dense ? "px-2.5 py-1" : "px-3 py-1.5 text-xs",
          isLive
            ? "bg-ink text-background group-hover:opacity-90"
            : "border border-dashed border-ink/20 text-ink-muted group-hover:border-ink/50 group-hover:text-ink",
        )}
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : isLive ? (
          forceLiveCTA ?? "Take a seat"
        ) : (
          "Open first"
        )}
      </span>
    </button>
  );
}

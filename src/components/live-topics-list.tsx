import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Loader2, Plus, Sparkles } from "lucide-react";
import { listActiveInstantRooms, type ActiveInstantRoom } from "@/lib/instant.functions";
import { CATEGORIES, type Category } from "@/lib/categories";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TOPIC_DESCRIPTIONS, SUB_MEDIUMS } from "@/lib/topic-prompts";
import { cn } from "@/lib/utils";

type Props = {
  busyKey?: string | null;
  onPick: (medium: Category | null) => void;
  onLiveCountChange?: (n: number) => void;
  /** Emits a fresh per-medium live count map whenever it changes. */
  onLiveByMediumChange?: (m: Map<Category, number>) => void;
  disabled?: boolean;
  /** "stack" = single column (mobile default), "split" = featured Any + topic grid (desktop). */
  layout?: "stack" | "split";
  /** Optional slot rendered under the featured "Any topic" card (e.g. prompt marquee). */
  featuredFooter?: React.ReactNode;
};

const SUB_PARENTS = new Set<Category>(["critique", "coworking"]);

export function LiveTopicsList({
  busyKey,
  onPick,
  onLiveCountChange,
  onLiveByMediumChange,
  disabled,
  layout = "stack",
  featuredFooter,
}: Props) {
  const fetchRooms = useServerFn(listActiveInstantRooms);
  const [showAll, setShowAll] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    onLiveByMediumChange?.(liveByMedium);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveByMedium]);

  const participantsByMedium = useMemo(() => {
    const m = new Map<Category, ActiveInstantRoom["participants"]>();
    for (const r of rooms) {
      if (!r.medium) continue;
      const list = m.get(r.medium as Category) ?? [];
      for (const p of r.participants) {
        if (list.length >= 3) break;
        if (!list.find((x) => x.user_id === p.user_id)) list.push(p);
      }
      m.set(r.medium as Category, list);
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

  // Idle auto-scroll for the topic list (split layout, desktop).
  useEffect(() => {
    if (layout !== "split") return;
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const el = scrollerRef.current;
    if (!el) return;

    let raf = 0;
    let lastTs = 0;
    let lastInteraction = Date.now();
    const IDLE_MS = 4000;
    const PX_PER_S = 12;

    function bump() { lastInteraction = Date.now(); }
    const events: (keyof HTMLElementEventMap)[] = [
      "pointerenter", "pointermove", "wheel", "touchstart", "focusin", "keydown",
    ];
    events.forEach((ev) => el.addEventListener(ev, bump, { passive: true }));

    function tick(ts: number) {
      if (!el) return;
      if (!lastTs) lastTs = ts;
      const dt = ts - lastTs;
      lastTs = ts;
      const idle = Date.now() - lastInteraction;
      const maxScroll = el.scrollHeight - el.clientHeight;
      if (idle > IDLE_MS && maxScroll > 4) {
        const next = el.scrollTop + (PX_PER_S * dt) / 1000;
        // Loop back to top once we hit the bottom; brief pause built into next idle window.
        if (next >= maxScroll) {
          el.scrollTop = 0;
          lastInteraction = Date.now();
        } else {
          el.scrollTop = next;
        }
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      events.forEach((ev) => el.removeEventListener(ev, bump));
    };
  }, [layout, visible.length, showAll]);

  const noneLive = liveCount === 0;

  if (layout === "split") {
    return (
      <div
        ref={listRef}
        onKeyDown={handleListKeyDown}
        className="rounded-2xl border border-border/70 bg-surface shadow-soft overflow-hidden grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]"
      >
        {/* Featured: Any topic */}
        <div className="md:border-r border-border/70 border-b md:border-b-0 bg-gradient-to-br from-muted/40 via-muted/20 to-transparent flex flex-col">
          <button
            type="button"
            data-row
            onClick={() => onPick(null)}
            disabled={disabled || busyKey === "any"}
            className={cn(
              "group relative text-left p-5 md:p-6 transition",
              "hover:bg-muted/30 disabled:opacity-60",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink/20",
            )}
          >
            <span aria-hidden className="pointer-events-none absolute right-6 top-6 inline-flex gap-1.5 opacity-40">
              <span className="h-1.5 w-1.5 rounded-full gradient-motion opacity-70" />
              <span className="h-1.5 w-1.5 rounded-full gradient-motion opacity-50 translate-y-1" />
              <span className="h-1.5 w-1.5 rounded-full gradient-motion opacity-30 translate-y-2" />
            </span>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-ink-muted">
              <Sparkles className="h-3 w-3" />
              {noneLive ? "Start the night" : "Jump in"}
              {!noneLive && (
                <span className="tabular-nums text-ink/70">· {liveCount} live</span>
              )}
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <div className="font-display text-2xl md:text-[28px] leading-none text-ink">
                Any topic
              </div>
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
                  {noneLive ? "Open the first room" : "Match me to a seat"}
                  <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
                </>
              )}
            </div>
          </button>
          {featuredFooter && (
            <div className="px-5 md:px-6 pb-5">{featuredFooter}</div>
          )}
        </div>

        {/* Topics column */}
        <div className="flex flex-col min-h-0">
          <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
            <div className="text-[11px] uppercase tracking-wider text-ink-muted">By topic</div>
            <div className={cn("text-[11px] tabular-nums", liveCount > 0 ? "text-ink" : "text-ink-muted")}>
              {liveCount} {liveCount === 1 ? "person" : "people"} live
            </div>
          </div>
          <div
            ref={scrollerRef}
            className="scrollbar-none overflow-y-auto"
            style={{ maxHeight: 360 }}
          >
            <ul className="divide-y divide-border/60">
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
                        id={c.id}
                        label={c.label}
                        description={TOPIC_DESCRIPTIONS[c.id]}
                        hasSubMediums={SUB_PARENTS.has(c.id)}
                        live={live}
                        participants={participantsByMedium.get(c.id) ?? []}
                        busy={busyKey === c.id}
                        disabled={disabled}
                        dense
                        onClick={() => onPick(c.id)}
                        onPickSub={(m) => onPick(m)}
                      />
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </div>
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
          id="any"
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
                  id={c.id}
                  label={c.label}
                  description={TOPIC_DESCRIPTIONS[c.id]}
                  hasSubMediums={SUB_PARENTS.has(c.id)}
                  live={live}
                  busy={busyKey === c.id}
                  disabled={disabled}
                  onClick={() => onPick(c.id)}
                  onPickSub={(m) => onPick(m)}
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
  id,
  label,
  sublabel,
  description,
  hasSubMediums,
  live,
  participants,
  icon,
  highlight,
  busy,
  disabled,
  onClick,
  onPickSub,
  dense,
  forceLiveCTA,
}: {
  id: string;
  label: string;
  sublabel?: string;
  description?: string;
  hasSubMediums?: boolean;
  live: number;
  participants?: ActiveInstantRoom["participants"];
  icon?: React.ReactNode;
  highlight?: boolean;
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
  onPickSub?: (m: Category) => void;
  dense?: boolean;
  forceLiveCTA?: string;
}) {
  const isLive = live > 0;
  const stack = (participants ?? []).slice(0, 3);
  const [hovered, setHovered] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const showDescription = !!description && (hovered || subOpen);

  return (
    <div
      data-topic={id}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      className={cn(
        "group relative w-full transition",
        "hover:bg-muted/40",
        highlight && "bg-muted/30",
      )}
    >
      <div className={cn("flex items-center gap-3", dense ? "px-4" : "px-5")}>
        <button
          type="button"
          data-row
          onClick={onClick}
          disabled={disabled || busy}
          className={cn(
            "flex flex-1 items-center gap-3 text-left min-w-0",
            dense ? "py-2.5" : "py-3.5",
            "disabled:opacity-60",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 rounded-md",
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
            {/* Hover-reveal description — grid trick avoids layout jump */}
            {description && (
              <div
                className={cn(
                  "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
                  showDescription ? "grid-rows-[1fr] opacity-100 mt-0.5" : "grid-rows-[0fr] opacity-0",
                )}
              >
                <div className="overflow-hidden">
                  <p className="text-[11.5px] leading-snug text-ink-muted">{description}</p>
                </div>
              </div>
            )}
          </div>
        </button>

        {/* Avatar stack — clicking still goes through the row */}
        {isLive && stack.length > 0 && (
          <div className="hidden sm:flex -space-x-1.5 shrink-0">
            {stack.map((p) => {
              const name = p.display_name || p.username || "Anon";
              return (
                <Avatar key={p.user_id} className="h-5 w-5 ring-2 ring-surface">
                  <AvatarImage src={p.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[9px]">{name[0]}</AvatarFallback>
                </Avatar>
              );
            })}
          </div>
        )}

        {/* Sub-medium picker for Critique / Co-working */}
        {hasSubMediums && onPickSub && (
          <Popover open={subOpen} onOpenChange={setSubOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Pick a medium under ${label}`}
                disabled={disabled}
                className={cn(
                  "shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full",
                  "text-ink-muted hover:text-ink hover:bg-muted/60 transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-44 p-1">
              <div className="px-2 pt-1.5 pb-1 text-[10px] uppercase tracking-wider text-ink-muted">
                {label} · pick a medium
              </div>
              <ul className="flex flex-col">
                {SUB_MEDIUMS.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => { setSubOpen(false); onPickSub(m.id); }}
                      className="w-full text-left rounded-md px-2 py-1.5 text-[13px] text-ink hover:bg-muted/60 transition"
                    >
                      {m.label}
                    </button>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        )}

        <button
          type="button"
          onClick={onClick}
          disabled={disabled || busy}
          tabIndex={-1}
          aria-hidden
          className={cn(
            "shrink-0 rounded-full text-[11px] font-medium transition tabular-nums inline-flex items-center gap-1",
            dense ? "px-2.5 py-1" : "px-3 py-1.5 text-xs",
            isLive
              ? "bg-ink text-background group-hover:opacity-90"
              : "text-ink-muted group-hover:text-ink",
          )}
        >
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : isLive ? (
            forceLiveCTA ?? "Take a seat"
          ) : (
            <>
              <Plus className="h-3 w-3" />
              Start
            </>
          )}
        </button>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { ChevronDown, Loader2 } from "lucide-react";
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

  const sorted = useMemo(() => {
    return [...CATEGORIES].sort((a, b) => {
      const la = liveByMedium.get(a.id) ?? 0;
      const lb = liveByMedium.get(b.id) ?? 0;
      return lb - la;
    });
  }, [liveByMedium]);

  // Arrow-key navigation between topic rows
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
    const PX_PER_S = 10;

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
  }, [layout]);

  const noneLive = liveCount === 0;

  // ── Shared building blocks ──────────────────────────────────────────────

  const eyebrow = (
    <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.14em] text-ink-muted/80">
      <PulseDots active={!noneLive} />
      <span>{noneLive ? "Start the night" : "Live now"}</span>
      {!noneLive && (
        <span className="tabular-nums text-ink/55">· {liveCount}</span>
      )}
    </div>
  );

  const splitCTA = (
    <SplitOpenButton
      noneLive={noneLive}
      busyAny={busyKey === "any"}
      disabled={disabled}
      liveByMedium={liveByMedium}
      busyKey={busyKey}
      onPickAny={() => onPick(null)}
      onPickMedium={(m) => onPick(m)}
    />
  );

  // ── Split layout (desktop) ──────────────────────────────────────────────

  if (layout === "split") {
    return (
      <div
        ref={listRef}
        onKeyDown={handleListKeyDown}
        className="relative rounded-3xl bg-surface shadow-halo overflow-hidden grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]"
      >
        {/* Featured: Any topic */}
        <div className="md:border-r border-border/50 border-b md:border-b-0 flex flex-col relative">
          {/* "now playing" hairline */}
          <div className="absolute inset-x-0 top-0 h-px gradient-motion opacity-60 pointer-events-none" />
          <div className="p-5 md:p-6 pb-4">
            {eyebrow}
            <h2 className="mt-3 font-display text-[26px] md:text-[30px] leading-[1.05] text-ink tracking-tight">
              Any topic
            </h2>
            <p className="mt-1.5 text-[13px] text-ink-muted/90 max-w-[28ch]">
              {noneLive
                ? "Be the first in tonight. We'll open the room."
                : "We'll drop you in the best open seat right now."}
            </p>
            <div className="mt-4">{splitCTA}</div>
          </div>
          {featuredFooter && (
            <div className="px-5 md:px-6 pb-5 mt-auto">{featuredFooter}</div>
          )}
        </div>

        {/* Topics column */}
        <div className="flex flex-col min-h-0 relative">
          {/* Pulse bar */}
          <div className="relative h-px overflow-hidden">
            <div
              className={cn(
                "absolute inset-0",
                noneLive ? "bg-border/60" : "gradient-motion opacity-70 animate-pulse",
              )}
            />
          </div>

          <div className="flex items-center justify-between px-4 pt-3.5 pb-1.5">
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-ink-muted/80">By topic</div>
            <div
              className={cn(
                "text-[10.5px] tabular-nums",
                liveCount > 0 ? "text-ink/70" : "text-ink-muted/60",
              )}
            >
              {liveCount} live
            </div>
          </div>

          <div
            ref={scrollerRef}
            className="scrollbar-none overflow-y-auto"
            style={{ maxHeight: 380 }}
          >
            <ul className="divide-y divide-border/40">
              {sorted.map((c) => {
                const live = liveByMedium.get(c.id) ?? 0;
                return (
                  <motion.li key={c.id} layout transition={{ duration: 0.2 }}>
                    <TopicRow
                      id={c.id}
                      label={c.label}
                      description={TOPIC_DESCRIPTIONS[c.id]}
                      hasSubMediums={SUB_PARENTS.has(c.id)}
                      live={live}
                      participants={participantsByMedium.get(c.id) ?? []}
                      busy={busyKey === c.id}
                      disabled={disabled}
                      onClick={() => onPick(c.id)}
                      onPickSub={(m) => onPick(m)}
                    />
                  </motion.li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // ── Stack layout (mobile) ───────────────────────────────────────────────

  return (
    <div
      ref={listRef}
      onKeyDown={handleListKeyDown}
      className="rounded-3xl bg-surface shadow-halo overflow-hidden"
    >
      <div className="relative p-5 pb-4">
        <div className="absolute inset-x-0 top-0 h-px gradient-motion opacity-60 pointer-events-none" />
        {eyebrow}
        <h2 className="mt-3 font-display text-[26px] leading-[1.05] text-ink tracking-tight">
          Any topic
        </h2>
        <p className="mt-1.5 text-[13px] text-ink-muted/90">
          {noneLive
            ? "Be the first in tonight. We'll open the room."
            : "We'll drop you in the best open seat."}
        </p>
        <div className="mt-4">{splitCTA}</div>
      </div>
      <div className="border-t border-border/50">
        <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
          <div className="text-[10.5px] uppercase tracking-[0.14em] text-ink-muted/80">By topic</div>
          <div className="text-[10.5px] text-ink-muted tabular-nums">{liveCount} live</div>
        </div>
        <ul className="divide-y divide-border/40">
          {sorted.map((c) => {
            const live = liveByMedium.get(c.id) ?? 0;
            return (
              <motion.li key={c.id} layout transition={{ duration: 0.2 }}>
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
        </ul>
      </div>
      {featuredFooter && (
        <div className="border-t border-border/50 px-4 py-3">{featuredFooter}</div>
      )}
    </div>
  );
}

// ── Small subcomponents ──────────────────────────────────────────────────

function PulseDots({ active }: { active: boolean }) {
  return (
    <span aria-hidden className="inline-flex items-center gap-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            "h-1 w-1 rounded-full transition",
            active ? "gradient-motion" : "bg-ink/15",
            active && "animate-pulse",
          )}
          style={active ? { animationDelay: `${i * 180}ms` } : undefined}
        />
      ))}
    </span>
  );
}

function SplitOpenButton({
  noneLive,
  busyAny,
  disabled,
  liveByMedium,
  busyKey,
  onPickAny,
  onPickMedium,
}: {
  noneLive: boolean;
  busyAny: boolean;
  disabled?: boolean;
  liveByMedium: Map<Category, number>;
  busyKey?: string | null;
  onPickAny: () => void;
  onPickMedium: (m: Category) => void;
}) {
  const [open, setOpen] = useState(false);
  const primaryLabel = noneLive ? "Open the first room" : "Match me to a seat";
  const primary = (
    <button
      type="button"
      data-row
      onClick={onPickAny}
      disabled={disabled || busyAny}
      className={cn(
        "group/btn inline-flex items-center gap-2 rounded-l-full bg-ink text-background",
        "pl-5 pr-4 py-2.5 text-[13px] font-medium tracking-tight",
        "transition hover:bg-ink/90 disabled:opacity-60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
      )}
    >
      {busyAny ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <>
          {primaryLabel}
          <span aria-hidden className="transition-transform group-hover/btn:translate-x-0.5">→</span>
        </>
      )}
    </button>
  );

  return (
    <div className="inline-flex items-stretch shadow-halo-sm rounded-full">
      {primary}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Pick a topic"
            disabled={disabled}
            className={cn(
              "inline-flex items-center justify-center rounded-r-full bg-ink text-background",
              "border-l border-background/20 px-3 py-2.5",
              "transition hover:bg-ink/90 disabled:opacity-60",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
            )}
          >
            <motion.span
              animate={{ rotate: open ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              className="inline-flex"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </motion.span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={6} className="w-56 p-1.5">
          <div className="px-2 pt-1 pb-1.5 text-[10px] uppercase tracking-[0.14em] text-ink-muted/80">
            Jump straight into
          </div>
          <ul className="flex flex-col">
            {CATEGORIES.map((c) => {
              const live = liveByMedium.get(c.id) ?? 0;
              const isBusy = busyKey === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={disabled || isBusy}
                    onClick={() => { setOpen(false); onPickMedium(c.id); }}
                    className={cn(
                      "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-ink",
                      "hover:bg-muted/60 transition disabled:opacity-60",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full shrink-0",
                        live > 0 ? "bg-primary" : "border border-ink/20",
                      )}
                    />
                    <span className="flex-1 text-left">{c.label}</span>
                    {live > 0 && (
                      <span className="text-[10.5px] tabular-nums text-ink-muted">{live} live</span>
                    )}
                    {isBusy && <Loader2 className="h-3 w-3 animate-spin text-ink-muted" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function TopicRow({
  id,
  label,
  description,
  hasSubMediums,
  live,
  participants,
  busy,
  disabled,
  onClick,
  onPickSub,
}: {
  id: string;
  label: string;
  description?: string;
  hasSubMediums?: boolean;
  live: number;
  participants?: ActiveInstantRoom["participants"];
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
  onPickSub?: (m: Category) => void;
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
        "hover:bg-muted/35",
      )}
    >
      <div className="flex items-center gap-2 px-4">
        <button
          type="button"
          data-row
          onClick={onClick}
          disabled={disabled || busy}
          className={cn(
            "flex flex-1 items-center gap-2.5 text-left min-w-0 py-2.5",
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
            <div className="flex items-center gap-1.5 font-medium text-ink text-[13.5px]">
              <span className="truncate">{label}</span>
              {isLive && (
                <span className="text-[10.5px] font-normal text-ink/55 tabular-nums">·{live}</span>
              )}
            </div>
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

        {/* Avatar stack — only renders when there are live participants */}
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
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") e.stopPropagation();
                }}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-44 p-1">
              <div className="px-2 pt-1.5 pb-1 text-[10px] uppercase tracking-[0.14em] text-ink-muted/80">
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

        {/* Hover-only arrow affordance — replaces the noisy +Start pill */}
        <span
          aria-hidden
          className={cn(
            "shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full text-ink-muted",
            "opacity-0 -translate-x-1 transition-all duration-150",
            "group-hover:opacity-100 group-hover:translate-x-0 group-focus-within:opacity-100 group-focus-within:translate-x-0",
            busy && "opacity-100 translate-x-0",
          )}
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <span className="text-[13px]">→</span>}
        </span>
      </div>
    </div>
  );
}

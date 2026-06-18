import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ChevronDown, Loader2 } from "lucide-react";
import { listActiveInstantRooms, type ActiveInstantRoom } from "@/lib/instant.functions";
import { CATEGORIES, categoryClass, type Category } from "@/lib/categories";
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
  /** Optional slot rendered under the featured "Lounge" card (e.g. prompt marquee). */
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

  // Lounge = the general / matchmaker rooms (no specific medium).
  const loungeRooms = useMemo(() => rooms.filter((r) => !r.medium), [rooms]);
  const loungeLive = useMemo(
    () => loungeRooms.reduce((acc, r) => acc + r.live_count, 0),
    [loungeRooms],
  );
  const loungeParticipants = useMemo(() => {
    const list: ActiveInstantRoom["participants"] = [];
    for (const r of loungeRooms) {
      for (const p of r.participants) {
        if (list.length >= 3) break;
        if (!list.find((x) => x.user_id === p.user_id)) list.push(p);
      }
      if (list.length >= 3) break;
    }
    return list;
  }, [loungeRooms]);

  const sorted = useMemo(() => {
    // Pin Critique (2nd) and Co-working (3rd) right under the Lounge; everything
    // else falls in line by live count.
    const pinOrder: Partial<Record<Category, number>> = { critique: 0, coworking: 1 };
    return [...CATEGORIES].sort((a, b) => {
      const pa = pinOrder[a.id];
      const pb = pinOrder[b.id];
      if (pa !== undefined || pb !== undefined) {
        if (pa === undefined) return 1;
        if (pb === undefined) return -1;
        return pa - pb;
      }
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

  // Pill eyebrow with primary ping dot — matches "Live editorial" direction.
  const eyebrow = (
    <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-primary">
      <span className="relative inline-flex h-1.5 w-1.5">
        {!noneLive && (
          <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-70" />
        )}
        <span className={cn(
          "relative inline-flex h-1.5 w-1.5 rounded-full",
          noneLive ? "bg-primary/40" : "bg-primary",
        )} />
      </span>
      <span>{noneLive ? "Start the night" : "Live now"}</span>
      {!noneLive && (
        <span className="tabular-nums text-primary/70">· {liveCount}</span>
      )}
    </div>
  );

  const splitCTA = (
    <SplitOpenButton
      noneLive={noneLive}
      busyAny={busyKey === "any"}
      disabled={disabled}
      liveByMedium={liveByMedium}
      loungeLive={loungeLive}
      busyKey={busyKey}
      onPickAny={() => onPick(null)}
      onPickMedium={(m) => onPick(m)}
    />
  );

  // Pinned "Lounge" row — rendered as the first item in the topic list.
  const loungeRow = (
    <motion.li key="lounge" layout transition={{ duration: 0.2 }}>
      <TopicRow
        id="lounge"
        label="Lounge"
        eyebrow="Pinned"
        accent
        description="Mixed-medium drop-in. Whoever shows up."
        live={loungeLive}
        participants={loungeParticipants}
        busy={busyKey === "any"}
        disabled={disabled}
        onClick={() => onPick(null)}
      />
    </motion.li>
  );

  // ── Split layout (desktop) ──────────────────────────────────────────────

  if (layout === "split") {
    return (
      <div
        ref={listRef}
        onKeyDown={handleListKeyDown}
        className="relative rounded-[2rem] bg-surface shadow-halo border border-border/50 overflow-hidden grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]"
      >
        {/* Featured: Lounge */}
        <div className="md:border-r border-border/50 border-b md:border-b-0 flex flex-col relative bg-background/40">
          <div className="p-7 md:p-9 pb-5 flex-1 flex flex-col">
            {eyebrow}
            <h2 className="mt-6 font-display text-[44px] md:text-[54px] leading-[0.95] text-ink tracking-tight">
              The Lounge
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-muted max-w-[34ch]">
              {noneLive
                ? "The town square for wandering minds. Open the room — the night starts here."
                : "The town square for wandering minds. Drop in, grab a seat, and see where the conversation leads."}
            </p>
            <div className="mt-8">{splitCTA}</div>
          </div>
          {featuredFooter && (
            <div className="border-t border-border/50 bg-surface/40">{featuredFooter}</div>
          )}
        </div>

        {/* Topics column */}
        <div className="flex flex-col min-h-0 relative">
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border/50">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-muted/70">
              Select a topic to enter
            </div>
            <div
              className={cn(
                "text-[10.5px] font-semibold tabular-nums",
                liveCount > 0 ? "text-primary" : "text-ink-muted/50",
              )}
            >
              {liveCount} live
            </div>
          </div>

          <div
            ref={scrollerRef}
            className="scrollbar-none overflow-y-auto p-3"
            style={{ height: 420 }}
          >
            <ul className="flex flex-col gap-0.5">
              {loungeRow}
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
      className="rounded-[1.75rem] bg-surface shadow-halo border border-border/50 overflow-hidden"
    >
      <div className="p-6 pb-5 bg-background/40">
        {eyebrow}
        <h2 className="mt-5 font-display text-[34px] leading-[0.95] text-ink tracking-tight">
          The Lounge
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
          {noneLive
            ? "Open the room — the night starts here."
            : "Drop in, grab a seat, see where the conversation leads."}
        </p>
        <div className="mt-5">{splitCTA}</div>
      </div>
      <div className="border-t border-border/50">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/50">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-muted/70">
            Select a topic to enter
          </div>
          <div className={cn(
            "text-[10.5px] font-semibold tabular-nums",
            liveCount > 0 ? "text-primary" : "text-ink-muted/50",
          )}>
            {liveCount} live
          </div>
        </div>
        <ul className="flex flex-col gap-0.5 p-2.5">
          {loungeRow}
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
        <div className="border-t border-border/50 bg-background/40">{featuredFooter}</div>
      )}
    </div>
  );
}

// ── Small subcomponents ──────────────────────────────────────────────────


function SplitOpenButton({
  noneLive,
  busyAny,
  disabled,
  liveByMedium,
  loungeLive,
  busyKey,
  onPickAny,
  onPickMedium,
}: {
  noneLive: boolean;
  busyAny: boolean;
  disabled?: boolean;
  liveByMedium: Map<Category, number>;
  loungeLive: number;
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
        "group/btn inline-flex flex-1 items-center justify-between gap-2 rounded-l-2xl bg-primary text-primary-foreground",
        "pl-5 pr-4 py-3.5 text-[14px] font-semibold tracking-tight",
        "transition hover:bg-primary/90 disabled:opacity-60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
      )}
    >
      {busyAny ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <span>{primaryLabel}</span>
          <span aria-hidden className="transition-transform group-hover/btn:translate-x-0.5">→</span>
        </>
      )}
    </button>
  );

  return (
    <div className="flex items-stretch rounded-2xl overflow-hidden border border-ink/10 shadow-halo-sm">
      {primary}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Pick a topic"
            disabled={disabled}
            className={cn(
              "inline-flex items-center justify-center bg-primary text-primary-foreground",
              "border-l border-primary-foreground/20 px-4",
              "transition hover:bg-primary/90 disabled:opacity-60",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
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
            <li key="lounge">
              <button
                type="button"
                disabled={disabled || busyAny}
                onClick={() => { setOpen(false); onPickAny(); }}
                className={cn(
                  "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-ink font-medium",
                  "hover:bg-muted/60 transition disabled:opacity-60",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full shrink-0",
                    loungeLive > 0 ? "bg-primary" : "border border-ink/20",
                  )}
                />
                <span className="flex-1 text-left">Lounge</span>
                <span className="text-[9px] uppercase tracking-[0.14em] text-ink-muted/70">General</span>
                {loungeLive > 0 && (
                  <span className="text-[10.5px] tabular-nums text-ink-muted">{loungeLive} live</span>
                )}
                {busyAny && <Loader2 className="h-3 w-3 animate-spin text-ink-muted" />}
              </button>
            </li>
            <li aria-hidden className="my-1 h-px bg-border/50" />
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
  eyebrow,
  accent,
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
  eyebrow?: string;
  accent?: boolean;
}) {
  const isLive = live > 0;
  const stack = (participants ?? []).slice(0, 3);
  const [hovered, setHovered] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const showDescription = !!description && (hovered || subOpen);

  // Color swatch: per-category token, or primary for the Lounge / accent row.
  const swatchClass = id === "lounge" || accent
    ? "bg-primary"
    : (categoryClass(id as Category)?.split(" ")[0] ?? "bg-muted");

  return (
    <div
      data-topic={id}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      className={cn(
        "group relative w-full rounded-2xl border border-transparent transition-all",
        "hover:bg-background/60 hover:border-border/60",
        accent && "bg-primary/[0.04] border-primary/15",
        !isLive && !accent && "opacity-70 hover:opacity-100",
      )}
    >
      <div className="flex items-center gap-3 px-4">
        <button
          type="button"
          data-row
          onClick={onClick}
          disabled={disabled || busy}
          className={cn(
            "flex flex-1 items-center gap-3.5 text-left min-w-0 py-3",
            "disabled:opacity-60",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 rounded-xl",
          )}
        >
          {/* Category swatch dot */}
          <span className="relative inline-flex h-2.5 w-2.5 shrink-0">
            {isLive && (
              <span className={cn("absolute inset-0 animate-ping rounded-full opacity-60", swatchClass)} />
            )}
            <span className={cn(
              "relative inline-flex h-2.5 w-2.5 rounded-full ring-2 ring-surface",
              swatchClass,
            )} />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-ink text-[14px] font-semibold tracking-tight">
              <span className="truncate">{label}</span>
              {eyebrow && (
                <span className="shrink-0 rounded-md bg-ink/[0.06] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-ink-muted/70">
                  {eyebrow}
                </span>
              )}
            </div>
            {description && (
              <div
                className={cn(
                  "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
                  showDescription ? "grid-rows-[1fr] opacity-100 mt-1" : "grid-rows-[0fr] opacity-0",
                )}
              >
                <div className="overflow-hidden">
                  <p className="text-[12px] leading-snug text-ink-muted">{description}</p>
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
              const avatar = (
                <Avatar className="h-6 w-6 ring-2 ring-surface transition hover:ring-primary/40">
                  <AvatarImage src={p.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[9px]">{name[0]}</AvatarFallback>
                </Avatar>
              );
              return p.username ? (
                <Link
                  key={p.user_id}
                  to="/u/$username"
                  params={{ username: p.username }}
                  aria-label={`Open ${name}'s profile`}
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  className="block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  {avatar}
                </Link>
              ) : (
                <span key={p.user_id}>{avatar}</span>
              );
            })}
          </div>
        )}

        {/* Live count badge — bold primary if live, muted if quiet */}
        <span className={cn(
          "shrink-0 text-[11.5px] font-bold tabular-nums tracking-tight",
          isLive ? "text-primary" : "text-ink-muted/40",
        )}>
          {live}
        </span>

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
                  "text-ink-muted hover:text-ink hover:bg-ink/5 transition",
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

        {busy && (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-ink-muted" />
        )}
      </div>
    </div>
  );
}

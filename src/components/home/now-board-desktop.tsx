import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, type LinkProps } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { toast } from "sonner";

import type { MemberHomePayload } from "@/lib/home-types";
import type { HomeNowItem, HomeNowLane } from "@/lib/home-now-types";
import { HOME_NOW_LANES } from "@/lib/home-now-types";
import { buildNowBoard, markShown, sessionSeed } from "@/lib/home-now-select";
import { createMyBlogDraft } from "@/lib/blog-member.functions";
import { isBlogSeedPromptId } from "@/lib/blog-seed-prompts";
import { cn } from "@/lib/utils";

const ROTATE_MS = 11_000;
const STAGGER_MS = [0, 2_000, 4_000];

/**
 * TanStack's Link is typed against literal route paths; board destinations are
 * data. This keeps the single unavoidable cast in one place.
 */
function BoardLink({
  to,
  params,
  search,
  className,
  children,
}: {
  to: string;
  params?: Record<string, string>;
  search?: Record<string, string | number | boolean>;
  className?: string;
  children: React.ReactNode;
}) {
  const props = { to, params, search, className } as unknown as LinkProps;
  return <Link {...props}>{children}</Link>;
}

function LaneRow({ item }: { item: HomeNowItem }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {item.isLive ? (
          <span className="inline-block size-1.5 rounded-full bg-[hsl(var(--signal,221_75%_54%))]" />
        ) : null}
        <span
          className={cn(
            "font-display text-[10px] uppercase tracking-[0.12em]",
            item.isLive ? "text-[hsl(var(--signal,221_75%_54%))]" : "text-white/45",
          )}
        >
          {item.status}
        </span>
      </div>
      <p className="font-display line-clamp-1 text-[15px] leading-snug text-white">{item.title}</p>
      <p className="line-clamp-1 text-xs text-white/50">{item.detail ?? "\u00a0"}</p>
    </div>
  );
}

export function NowBoardDesktop({ data }: { data: MemberHomePayload }) {
  const seed = useMemo(() => sessionSeed(), []);
  const board = useMemo(() => buildNowBoard(data, seed), [data, seed]);
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const createDraft = useServerFn(createMyBlogDraft);

  const [indices, setIndices] = useState<Record<HomeNowLane, number>>({
    live: 0,
    make: 0,
    explore: 0,
  });
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [pending, setPending] = useState<string | null>(null);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(() => {
    const stamp = () =>
      setUpdatedAt(
        new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      );
    stamp();
    const id = setInterval(stamp, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onVis = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const step = useCallback(
    (lane: HomeNowLane, delta: number) => {
      const len = board[lane].length;
      if (len < 2) return;
      setIndices((prev) => ({ ...prev, [lane]: (prev[lane] + delta + len) % len }));
    },
    [board],
  );

  const stepAll = useCallback(
    (delta: number) => {
      (["live", "make", "explore"] as HomeNowLane[]).forEach((lane) => step(lane, delta));
    },
    [step],
  );

  // Auto-rotation, staggered per lane. A single genuinely live item stays put.
  const frozen = reduceMotion || paused || hovered || tabHidden;
  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (frozen) return;
    const intervals: Array<ReturnType<typeof setInterval>> = [];
    (["live", "make", "explore"] as HomeNowLane[]).forEach((lane, i) => {
      if (board[lane].length < 2) return;
      const start = setTimeout(() => {
        step(lane, 1);
        intervals.push(setInterval(() => step(lane, 1), ROTATE_MS));
      }, STAGGER_MS[i]);
      timers.current.push(start);
    });
    return () => {
      timers.current.forEach(clearTimeout);
      intervals.forEach(clearInterval);
    };
  }, [frozen, board, step]);

  // Cooldown: remember what has been on screen this session.
  useEffect(() => {
    (["live", "make", "explore"] as HomeNowLane[]).forEach((lane) => {
      const item = board[lane][indices[lane] % Math.max(1, board[lane].length)];
      if (item) markShown(item.id);
    });
  }, [indices, board]);

  const runAction = useCallback(
    async (item: HomeNowItem) => {
      if (!item.action || pending) return;
      if (item.action.kind === "collab-prompt") {
        navigate({
          to: "/collab/new",
          search: {
            prompt: item.action.prompt,
            ...(item.action.groupSlug ? { group: item.action.groupSlug } : {}),
          },
        } as never);
        return;
      }
      const promptId = item.action.seedPromptId;
      if (!isBlogSeedPromptId(promptId)) return;
      setPending(item.id);
      try {
        const res = await createDraft({ data: { seedPromptId: promptId } });
        if (res.reused) toast("Opened your current draft.");
        navigate({ to: "/me/blog/$id", params: { id: res.id } });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't start a draft.");
      } finally {
        setPending(null);
      }
    },
    [createDraft, navigate, pending],
  );

  const anyLive = board.live.some((i) => i.isLive);

  return (
    <section
      aria-label="Now on Workshop"
      className="hidden overflow-hidden rounded-[10px] border border-white/10 bg-[#0b0b0c] lg:block"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-2.5">
        <p className="font-display text-[11px] uppercase tracking-[0.12em] text-white/50">
          Now
          {data.homeCity ? ` · ${data.homeCity.name}` : ""}
          {updatedAt ? ` · Updated ${updatedAt}` : ""}
          {anyLive ? " · Live" : ""}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous suggestions"
            onClick={() => stepAll(-1)}
            className="rounded-[6px] p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label={paused ? "Resume rotation" : "Pause rotation"}
            aria-pressed={paused}
            onClick={() => setPaused((p) => !p)}
            className="rounded-[6px] p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
          </button>
          <button
            type="button"
            aria-label="Next suggestions"
            onClick={() => stepAll(1)}
            className="rounded-[6px] p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </header>

      <div className="grid h-[136px] grid-cols-3 divide-x divide-white/10">
        {HOME_NOW_LANES.map(({ lane, label }) => {
          const items = board[lane];
          const item = items[indices[lane] % Math.max(1, items.length)];
          return (
            <div key={lane} className="flex flex-col gap-3 px-5 py-4">
              <p className="font-display text-[10px] uppercase tracking-[0.12em] text-white/35">
                {lane === "live" && !anyLive ? "Right now" : label}
              </p>
              <div className="relative flex-1" style={{ perspective: 600 }}>
                <AnimatePresence mode="wait" initial={false}>
                  {item ? (
                    <motion.div
                      key={item.id}
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, rotateX: -35, y: 8 }}
                      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, rotateX: 0, y: 0 }}
                      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, rotateX: 25, y: -8 }}
                      transition={{ duration: reduceMotion ? 0.15 : 0.36, ease: "easeOut" }}
                      className="absolute inset-0"
                    >
                      {item.action ? (
                        <button
                          type="button"
                          onClick={() => void runAction(item)}
                          disabled={pending === item.id}
                          className="block w-full rounded-[6px] text-left outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--signal,221_75%_54%))] disabled:opacity-60"
                        >
                          <LaneRow item={item} />
                        </button>
                      ) : item.to ? (
                        <BoardLink
                          to={item.to}
                          params={item.params}
                          search={item.search}
                          className="block rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--signal,221_75%_54%))]"
                        >
                          <LaneRow item={item} />
                        </BoardLink>
                      ) : (
                        <LaneRow item={item} />
                      )}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function NowBoardDesktopSkeleton() {
  return (
    <div className="hidden h-[186px] animate-pulse rounded-[10px] border border-white/10 bg-[#0b0b0c] lg:block" />
  );
}

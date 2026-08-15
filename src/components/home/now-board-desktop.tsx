import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

import type { MemberHomePayload } from "@/lib/home-types";
import type { HomeNowItem } from "@/lib/home-now-types";
import { HOME_NOW_LANES } from "@/lib/home-now-types";
import { useNowBoard } from "@/hooks/use-now-board";
import { HereNowCluster } from "@/components/here-now-cluster";
import { cn } from "@/lib/utils";

/**
 * TanStack's Link is typed against literal route paths; board destinations are
 * runtime data, so this wrapper holds the single loosely-typed Link in the file.
 * Typing it through LinkProps instead poisons router inference project-wide.
 */
const AnyLink = Link as unknown as (props: {
  to: string;
  params?: Record<string, string>;
  search?: Record<string, string | number | boolean>;
  className?: string;
  children: React.ReactNode;
}) => React.ReactElement;

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
  return (
    <AnyLink to={to} params={params} search={search} className={className}>
      {children}
    </AnyLink>
  );
}

function LaneRow({ item }: { item: HomeNowItem }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {item.isLive ? <span className="inline-block size-1.5 rounded-full bg-signal" /> : null}
        <span
          className={cn(
            "font-display text-[10px] uppercase tracking-[0.12em]",
            item.isLive ? "text-signal" : "text-ink-muted",
          )}
        >
          {item.status}
        </span>
      </div>
      <p className="font-display line-clamp-1 text-[15px] leading-snug text-ink">{item.title}</p>
      <p className="line-clamp-1 text-xs text-ink-muted">{item.detail ?? "\u00a0"}</p>
    </div>
  );
}

export function NowBoardDesktop({ data }: { data: MemberHomePayload }) {
  const {
    current,
    stepAll,
    paused,
    setPaused,
    setHovered,
    pending,
    runAction,
    reduceMotion,
    anyLive,
  } = useNowBoard(data);

  const [updatedAt, setUpdatedAt] = useState<string>("");

  useEffect(() => {
    const stamp = () =>
      setUpdatedAt(
        new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      );
    stamp();
    const id = setInterval(stamp, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <section
      aria-label="Now on Workshop"
      className="hidden overflow-hidden rounded-[10px] border border-border bg-card lg:block"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-2.5">
        <p className="shrink-0 font-display text-[11px] uppercase tracking-[0.12em] text-ink-muted">
          Now
          {data.homeCity ? ` · ${data.homeCity.name}` : ""}
          {updatedAt ? ` · Updated ${updatedAt}` : ""}
          {anyLive ? " · Live" : ""}
        </p>
        <HereNowCluster cityGroupId={data.homeCityGroup?.id ?? null} className="ml-auto" />
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="Previous suggestions"
            onClick={() => stepAll(-1)}
            className="rounded-[6px] p-1 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label={paused ? "Resume rotation" : "Pause rotation"}
            aria-pressed={paused}
            onClick={() => setPaused((p) => !p)}
            className="rounded-[6px] p-1 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
          </button>
          <button
            type="button"
            aria-label="Next suggestions"
            onClick={() => stepAll(1)}
            className="rounded-[6px] p-1 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </header>

      <div className="grid h-[136px] grid-cols-3 divide-x divide-border">
        {HOME_NOW_LANES.map(({ lane, label }) => {
          const item = current(lane);
          return (
            <div key={lane} className="flex flex-col gap-3 px-5 py-4">
              <p className="font-display text-[10px] uppercase tracking-[0.12em] text-ink-muted">
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
                          className="block w-full rounded-[6px] text-left outline-none focus-visible:ring-2 focus-visible:ring-signal disabled:opacity-60"
                        >
                          <LaneRow item={item} />
                        </button>
                      ) : item.to ? (
                        <BoardLink
                          to={item.to}
                          params={item.params}
                          search={item.search}
                          className="block rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-signal"
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
    <div className="hidden h-[178px] animate-pulse rounded-[10px] border border-border bg-card lg:block" />
  );
}

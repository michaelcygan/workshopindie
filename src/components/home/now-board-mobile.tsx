import { AnimatePresence, motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Calendar, ChevronRight, Compass, MessageSquare, PenLine, Radio } from "lucide-react";

import type { MemberHomePayload } from "@/lib/home-types";
import type { HomeNowItem, HomeNowLane } from "@/lib/home-now-types";
import { useNowBoard } from "@/hooks/use-now-board";
import { cn } from "@/lib/utils";

const AnyLink = Link as unknown as (props: {
  to: string;
  params?: Record<string, string>;
  search?: Record<string, string | number | boolean>;
  className?: string;
  children: React.ReactNode;
}) => React.ReactElement;

function iconFor(item: HomeNowItem) {
  if (item.source === "audio") return Radio;
  if (item.source === "event") return Calendar;
  if (item.source === "today") return MessageSquare;
  if (item.lane === "make") return PenLine;
  if (item.lane === "explore") return Compass;
  return MessageSquare;
}

function RowBody({ item }: { item: HomeNowItem }) {
  const Icon = iconFor(item);
  return (
    <>
      <span className="relative grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border text-ink-muted">
        <Icon className="h-3.5 w-3.5" />
        {item.isLive && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-signal ring-2 ring-surface" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-[15px] leading-snug text-ink">{item.title}</div>
        {item.detail && <div className="truncate text-xs text-ink-soft">{item.detail}</div>}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" />
    </>
  );
}

const ROW_CLASS =
  "flex min-h-[56px] w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-muted/60";

/**
 * Mobile "Now" — same three lanes and same rotating suggestion pool as the
 * desktop departures board, rendered as stacked rows.
 */
export function NowBoardMobile({ data }: { data: MemberHomePayload }) {
  const { current, setHovered, pending, runAction, reduceMotion } = useNowBoard(data);

  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {(["live", "make", "explore"] as HomeNowLane[]).map((lane) => {
        const item = current(lane);
        if (!item) return null;
        return (
          <div
            key={lane}
            className="relative min-h-[56px]"
            onTouchStart={() => setHovered(true)}
            onTouchEnd={() => setHovered(false)}
            onTouchCancel={() => setHovered(false)}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={item.id}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: reduceMotion ? 0.15 : 0.28, ease: "easeOut" }}
              >
                {item.action ? (
                  <button
                    type="button"
                    onClick={() => void runAction(item)}
                    disabled={pending === item.id}
                    className={cn(ROW_CLASS, "disabled:opacity-60")}
                  >
                    <RowBody item={item} />
                  </button>
                ) : item.to ? (
                  <AnyLink
                    to={item.to}
                    params={item.params}
                    search={item.search}
                    className={ROW_CLASS}
                  >
                    <RowBody item={item} />
                  </AnyLink>
                ) : (
                  <div className={ROW_CLASS}>
                    <RowBody item={item} />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

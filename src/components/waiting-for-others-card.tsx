import { useEffect, useState } from "react";
import { Check, BellRing, X, Loader2, Link2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { pingMutualsForRoom } from "@/lib/instant.functions";

const SEAT_COUNT = 5;

type Props = {
  roomId: string;
  /** Hide the card. Parent decides when (e.g. when a 2nd live user appears). */
  visible: boolean;
  /** Only the host can ping mutuals; show the button conditionally. */
  canPingMutuals: boolean;
  /** How many seats are filled (1..5). Defaults to 1 — "you're first in". */
  filledSeats?: number;
  /** Viewer initial for the first seat dot. */
  viewerInitials?: string;
  /** Viewer avatar URL for the first seat dot, if available. */
  viewerAvatarUrl?: string | null;
};

export function WaitingForOthersCard({
  roomId,
  visible,
  canPingMutuals,
  filledSeats = 1,
  viewerInitials,
  viewerAvatarUrl,
}: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [copied, setCopied] = useState(false);
  const ping = useServerFn(pingMutualsForRoom);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(sessionStorage.getItem(`wf:waiting-dismissed:${roomId}`) === "1");
  }, [roomId]);

  const shouldShow = visible && !dismissed;
  const initials = (viewerInitials || "?").slice(0, 1).toUpperCase();
  const filled = Math.max(1, Math.min(SEAT_COUNT, filledSeats));
  const seatsLeft = SEAT_COUNT - filled;
  // Index of the next empty seat — used for the soft "one more would tip this live" pulse.
  const nextEmptyIdx = filled < SEAT_COUNT ? filled : -1;

  function shareUrl() {
    return `${window.location.origin}/workshop/${roomId}`;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Couldn't copy link");
    }
  }

  async function pingMutuals() {
    if (pinging) return;
    setPinging(true);
    try {
      const res = await ping({ data: { roomId } });
      if (res.notified > 0) toast.success(`Pinged ${res.notified} mutual${res.notified === 1 ? "" : "s"}`);
      else toast("No mutuals to ping right now", { description: "Share the link instead." });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't ping mutuals");
    } finally {
      setPinging(false);
    }
  }

  function dismiss() {
    sessionStorage.setItem(`wf:waiting-dismissed:${roomId}`, "1");
    setDismissed(true);
  }

  const headline =
    filled === 1
      ? "You're first in — invite a few people"
      : seatsLeft === 0
        ? "Room is full"
        : `${filled} here · ${seatsLeft} ${seatsLeft === 1 ? "seat" : "seats"} left`;

  return (
    <AnimatePresence initial={false}>
      {shouldShow && (
        <motion.div
          key="waiting-card"
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="mt-3 rounded-2xl border border-border/60 bg-surface/80 backdrop-blur-md px-4 py-3.5 shadow-lift"
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-medium text-ink">
                <span className="relative inline-flex h-2 w-2">
                  <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                {headline}
              </p>

              {/* Seat row — bigger, the hero of the card. Next empty seat pulses soft. */}
              <div className="mt-3 flex items-center gap-2" aria-label={`${filled} of ${SEAT_COUNT} seats filled`}>
                {Array.from({ length: SEAT_COUNT }).map((_, i) => {
                  const isFilled = i < filled;
                  const isFirst = i === 0;
                  const isNext = i === nextEmptyIdx;
                  return (
                    <motion.span
                      key={i}
                      layout
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.06 * i, duration: 0.25, ease: "easeOut" }}
                      className={
                        "relative inline-flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-medium " +
                        (isFilled
                          ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                          : isNext
                            ? "border border-dashed border-primary/40 text-primary/60"
                            : "border border-dashed border-border text-ink-muted/40")
                      }
                    >
                      {isNext && (
                        <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                      )}
                      {isFilled && isFirst ? (
                        viewerAvatarUrl ? (
                          <img src={viewerAvatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                        ) : (
                          initials
                        )
                      ) : isFilled ? (
                        <span className="h-2 w-2 rounded-full bg-primary" />
                      ) : null}
                    </motion.span>
                  );
                })}
                <span className="ml-1 text-[11px] text-ink-muted">
                  {filled}/{SEAT_COUNT}
                </span>
              </div>

              {/* One CTA. Morphs to a receipt on click. */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  className="rounded-full h-9 gap-1.5 px-4 min-w-[160px] justify-center"
                  onClick={copyLink}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {copied ? (
                      <motion.span
                        key="copied"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18 }}
                        className="inline-flex items-center gap-1.5"
                      >
                        <Check className="h-3.5 w-3.5" /> Link copied — paste anywhere
                      </motion.span>
                    ) : (
                      <motion.span
                        key="copy"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18 }}
                        className="inline-flex items-center gap-1.5"
                      >
                        <Link2 className="h-3.5 w-3.5" /> Copy invite link
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Button>
                {canPingMutuals && (
                  <button
                    type="button"
                    onClick={pingMutuals}
                    disabled={pinging}
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] text-ink-muted hover:text-ink transition disabled:opacity-50"
                  >
                    {pinging ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <BellRing className="h-3 w-3" />
                    )}
                    {pinging ? "Pinging…" : "or ping mutuals"}
                  </button>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={dismiss}
              className="text-ink-muted/60 hover:text-ink transition"
              aria-label="Hide for this session"
              title="Hide for this session"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

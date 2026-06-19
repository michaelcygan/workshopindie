import { useEffect, useState } from "react";
import { Share2, BellRing, X, Loader2, Twitter } from "lucide-react";
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
  const ping = useServerFn(pingMutualsForRoom);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(sessionStorage.getItem(`wf:waiting-dismissed:${roomId}`) === "1");
  }, [roomId]);

  const shouldShow = visible && !dismissed;
  const initials = (viewerInitials || "?").slice(0, 1).toUpperCase();
  const filled = Math.max(1, Math.min(SEAT_COUNT, filledSeats));

  function shareUrl() {
    return `${window.location.origin}/workshop/${roomId}`;
  }

  function copyLink() {
    navigator.clipboard?.writeText(shareUrl()).then(
      () => toast.success("Link copied — share to fill the room"),
      () => toast.error("Couldn't copy link"),
    );
  }

  function shareToX() {
    const text = "I'm in a live Workshop — first in, 4 seats left.";
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl())}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function shareToBluesky() {
    const text = `I'm in a live Workshop — first in, 4 seats left. ${shareUrl()}`;
    const url = `https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function pingMutuals() {
    if (pinging) return;
    setPinging(true);
    try {
      const res = await ping({ data: { roomId } });
      if (res.notified > 0) toast.success(`Pinged ${res.notified} mutual${res.notified === 1 ? "" : "s"}`);
      else toast("No mutuals to ping right now", { description: "Try sharing the link instead." });
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

  return (
    <AnimatePresence initial={false}>
      {shouldShow && (
        <motion.div
          key="waiting-card"
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="mt-3 rounded-2xl border border-border/60 bg-surface/80 backdrop-blur-md px-4 py-3 shadow-lift"
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-medium text-ink">
                <span className="relative inline-flex h-2 w-2">
                  <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                You're first in — invite a few people
              </p>

              {/* Seat row: literally shows "1 of 5 filled". */}
              <div className="mt-2 flex items-center gap-1.5" aria-label={`${filled} of ${SEAT_COUNT} seats filled`}>
                {Array.from({ length: SEAT_COUNT }).map((_, i) => {
                  const isFilled = i < filled;
                  const isFirst = i === 0;
                  return (
                    <motion.span
                      key={i}
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.08 * i, duration: 0.25, ease: "easeOut" }}
                      className={
                        "inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium " +
                        (isFilled
                          ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                          : "border border-dashed border-border text-ink-muted/40")
                      }
                    >
                      {isFilled && isFirst ? (
                        viewerAvatarUrl ? (
                          <img src={viewerAvatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                        ) : (
                          initials
                        )
                      ) : isFilled ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      ) : null}
                    </motion.span>
                  );
                })}
                <span className="ml-1 text-[11px] text-ink-muted">
                  {filled}/{SEAT_COUNT} seats
                </span>
              </div>

              <p className="mt-2 text-xs text-ink-muted">
                Mutuals who follow you back will see this in Live now.
              </p>

              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button size="sm" className="rounded-full h-8 gap-1.5" onClick={copyLink}>
                  <Share2 className="h-3.5 w-3.5" /> Copy link
                </Button>
                {canPingMutuals && (
                  <Button size="sm" variant="outline" className="rounded-full h-8 gap-1.5" onClick={pingMutuals} disabled={pinging}>
                    {pinging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />}
                    {pinging ? "Pinging…" : "Ping mutuals"}
                  </Button>
                )}
                <button
                  type="button"
                  onClick={shareToX}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-ink-muted hover:text-ink transition"
                  aria-label="Share to X"
                >
                  <Twitter className="h-3 w-3" /> X
                </button>
                <button
                  type="button"
                  onClick={shareToBluesky}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-ink-muted hover:text-ink transition"
                  aria-label="Share to Bluesky"
                >
                  Bluesky
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={dismiss}
              className="text-ink-muted hover:text-ink"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

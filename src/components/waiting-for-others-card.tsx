import { useEffect, useState } from "react";
import { Share2, BellRing, X, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { pingMutualsForRoom } from "@/lib/instant.functions";

type Props = {
  roomId: string;
  /** Hide the card. Parent decides when (e.g. when a 2nd live user appears). */
  visible: boolean;
  /** Only the host can ping mutuals; show the button conditionally. */
  canPingMutuals: boolean;
};

export function WaitingForOthersCard({ roomId, visible, canPingMutuals }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [pinging, setPinging] = useState(false);
  const ping = useServerFn(pingMutualsForRoom);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(sessionStorage.getItem(`wf:waiting-dismissed:${roomId}`) === "1");
  }, [roomId]);

  const shouldShow = visible && !dismissed;

  function copyLink() {
    const url = `${window.location.origin}/workshop/${roomId}`;
    navigator.clipboard?.writeText(url).then(
      () => toast.success("Link copied — share to fill the room"),
      () => toast.error("Couldn't copy link"),
    );
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
    <div className="mt-3 rounded-2xl border border-dashed border-border bg-surface px-4 py-3 shadow-soft">
      <div className="flex items-start gap-3">
        <div className="relative mt-0.5 inline-flex h-2 w-2 shrink-0">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">You're first in — share to fill the room</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            Up to 5 seats. People who follow you back will see this room in Live now.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="rounded-full h-8 gap-1.5" onClick={copyLink}>
              <Share2 className="h-3.5 w-3.5" /> Copy share link
            </Button>
            {canPingMutuals && (
              <Button size="sm" className="rounded-full h-8 gap-1.5" onClick={pingMutuals} disabled={pinging}>
                {pinging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />}
                {pinging ? "Pinging…" : "Ping mutuals"}
              </Button>
            )}
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
    </div>
  );
}

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Rocket, Crown, X } from "lucide-react";

/**
 * Floating nudge anchored bottom-right. Two independently-timed pills:
 *  • "Become host" — appears ~20s into a leaderless room (when `canClaimHost`).
 *  • "Create a Collab" — appears ~2min in once the room has some signal.
 * Each is dismissable per-room via localStorage.
 */
export function CreateCollabNudge({
  roomId,
  visible,
  onCreate,
  onClaimHost,
  canClaimHost = false,
}: {
  roomId: string;
  /** Eligibility for the Collab CTA (not promoted, viewer is host OR leaderless, has signal). */
  visible: boolean;
  onCreate: () => void;
  onClaimHost?: () => void | Promise<void>;
  /** Whether the standalone "Become host" pill should be eligible to appear. */
  canClaimHost?: boolean;
}) {
  const [showCollab, setShowCollab] = useState(false);
  const [showHost, setShowHost] = useState(false);
  const collabKey = `cc-nudge:${roomId}`;
  const hostKey = `cc-host:${roomId}`;

  useEffect(() => {
    if (!visible) {
      setShowCollab(false);
      return;
    }
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem(collabKey) === "1") return;
    } catch {}
    const t = window.setTimeout(() => setShowCollab(true), 120_000);
    const hide = window.setTimeout(() => setShowCollab(false), 120_000 + 25_000);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(hide);
    };
  }, [visible, collabKey]);

  useEffect(() => {
    if (!canClaimHost) {
      setShowHost(false);
      return;
    }
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem(hostKey) === "1") return;
    } catch {}
    const t = window.setTimeout(() => setShowHost(true), 20_000);
    return () => window.clearTimeout(t);
  }, [canClaimHost, hostKey]);

  function dismissCollab() {
    setShowCollab(false);
    try { localStorage.setItem(collabKey, "1"); } catch {}
  }
  function dismissHost() {
    setShowHost(false);
    try { localStorage.setItem(hostKey, "1"); } catch {}
  }

  return (
    <div className="pointer-events-none fixed bottom-20 right-4 z-40 flex max-w-[320px] flex-col items-end gap-2 md:bottom-6">
      <AnimatePresence>
        {showHost && canClaimHost && (
          <motion.div
            key="host-pill"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            className="pointer-events-auto"
          >
            <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-surface/95 backdrop-blur-md py-1 pl-2 pr-1 shadow-lift">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Crown className="h-3.5 w-3.5" />
              </span>
              <span className="text-[12px] font-medium text-ink">No host yet.</span>
              <button
                type="button"
                onClick={async () => {
                  try { await onClaimHost?.(); } finally { dismissHost(); }
                }}
                className="ml-1 inline-flex items-center rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90 transition"
              >
                Become host
              </button>
              <button
                type="button"
                onClick={dismissHost}
                aria-label="Dismiss"
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-muted transition"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </motion.div>
        )}

        {showCollab && (
          <motion.div
            key="collab-card"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-auto"
          >
            <div className="rounded-2xl border border-border/60 bg-surface/95 backdrop-blur-md p-3 shadow-lift">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Rocket className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink leading-tight">
                    Worth making this a Collab?
                  </p>
                  <p className="mt-0.5 text-[12px] text-ink-soft leading-snug">
                    Lock it in so people can find it later.
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => { dismissCollab(); onCreate(); }}
                      className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90 transition"
                    >
                      Create a Collab
                    </button>
                    {canClaimHost && onClaimHost && (
                      <button
                        type="button"
                        onClick={async () => {
                          try { await onClaimHost(); } finally { dismissCollab(); }
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2.5 py-1 text-[11px] font-medium text-ink-soft hover:text-ink hover:bg-muted transition"
                      >
                        <Crown className="h-3 w-3" /> Become host
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={dismissCollab}
                      className="rounded-full px-2 py-1 text-[11px] text-ink-muted hover:text-ink transition"
                    >
                      Not now
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={dismissCollab}
                  aria-label="Dismiss"
                  className="text-ink-muted hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

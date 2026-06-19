import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Rocket, X } from "lucide-react";

/**
 * Fires once per room session ~2 minutes in, suggesting that the host or any
 * present attendee (in a leaderless room) lock the session in as a persistent
 * Collab. Dismissable; stored per-room in localStorage so we don't repeat.
 */
export function CreateCollabNudge({
  roomId,
  visible,
  onCreate,
}: {
  roomId: string;
  /** Outer eligibility (not promoted, viewer is host OR leaderless, has signal). */
  visible: boolean;
  onCreate: () => void;
}) {
  const [show, setShow] = useState(false);
  const storageKey = `cc-nudge:${roomId}`;

  useEffect(() => {
    if (!visible) return;
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem(storageKey) === "1") return;
    } catch {}
    const t = window.setTimeout(() => setShow(true), 120_000);
    const hide = window.setTimeout(() => setShow(false), 120_000 + 25_000);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(hide);
    };
  }, [visible, storageKey]);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(storageKey, "1");
    } catch {}
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.25 }}
          className="fixed bottom-20 right-4 z-40 max-w-[320px] md:bottom-6"
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
                    onClick={() => {
                      dismiss();
                      onCreate();
                    }}
                    className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90 transition"
                  >
                    Create a Collab
                  </button>
                  <button
                    type="button"
                    onClick={dismiss}
                    className="rounded-full px-2 py-1 text-[11px] text-ink-muted hover:text-ink transition"
                  >
                    Not now
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={dismiss}
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
  );
}

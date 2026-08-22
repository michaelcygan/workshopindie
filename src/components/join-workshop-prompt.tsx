import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { SignupGateModal } from "@/components/signup-gate-modal";
import {
  isJoinPromptAllowedPath,
  readSnooze,
  shouldShowJoinPrompt,
  writeSnooze,
} from "@/lib/join-prompt-state";

const DWELL_MS = 8000;

/**
 * Logged-out invitation to join Workshop. Fires after real engagement —
 * 8 seconds of dwell or meaningful scroll depth, whichever comes first —
 * and then stays quiet for 7 days after any dismissal.
 */
export function JoinWorkshopPrompt() {
  const { user, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  const eligible = !loading && !user && !done && isJoinPromptAllowedPath(pathname);

  useEffect(() => {
    if (!eligible || open) return;
    if (!shouldShowJoinPrompt(Date.now(), readSnooze())) {
      setDone(true);
      return;
    }

    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      cleanup();
      setOpen(true);
    };

    const onScroll = () => {
      if (window.scrollY > window.innerHeight * 0.75) fire();
    };

    const timer = window.setTimeout(fire, DWELL_MS);
    window.addEventListener("scroll", onScroll, { passive: true });

    function cleanup() {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    }
    return cleanup;
  }, [eligible, open]);

  const dismiss = () => {
    writeSnooze(Date.now());
    setOpen(false);
    setDone(true);
  };

  if (!open) return null;

  return (
    <SignupGateModal
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
      title="Join Workshop"
      subtitle="Read, publish your work, and find people to make things with. Join the network for free."
      onAuthed={() => {
        setOpen(false);
        setDone(true);
      }}
      footer={
        <div className="space-y-3 border-t border-border pt-4 text-center">
          <p className="mx-auto max-w-[280px] text-[12px] leading-relaxed text-ink-muted">
            Free access includes the complete Workshop network within generous limits.{" "}
            <Link
              to="/pricing"
              className="text-ink underline-offset-2 hover:underline"
              onClick={dismiss}
            >
              Plus removes limits — $4.99/mo
            </Link>
          </p>
          <button
            type="button"
            onClick={dismiss}
            className="text-sm font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline"
          >
            Maybe later
          </button>
        </div>
      }
    />
  );
}

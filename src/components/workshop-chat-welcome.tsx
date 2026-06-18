import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";

// Per-user, per-room dismissible welcome card rendered above the chat scroll.
// Pure localStorage — no DB row, no fake bot user.

type Props = { roomKey: string };

export function WorkshopChatWelcome({ roomKey }: Props) {
  const key = `workshop-welcome-dismissed:${roomKey}`;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { setDismissed(!!window.localStorage.getItem(key)); } catch { /* ignore */ }
  }, [key]);

  if (dismissed) return null;

  function dismiss() {
    try { window.localStorage.setItem(key, "1"); } catch { /* ignore */ }
    setDismissed(true);
  }

  return (
    <div className="mx-3 mt-3 rounded-2xl border border-border bg-surface-2/70 p-3 sm:mx-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet/10 text-violet">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Welcome</div>
          <p className="mt-0.5 text-sm text-ink">
            <span className="font-medium">This is your Workshop.</span>{" "}
            <span className="text-ink-soft">
              Talk shop, share screens, drop in tools, and riff on the work. Everything here is ephemeral
              until someone creates a Collab. Have fun.
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss welcome"
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-muted hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { RadioTower, Wrench, Rocket, Share2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// localStorage-backed counter so the tour auto-runs for the host's first N workshops,
// then stays dismissed. Always re-openable via host menu.
const COUNT_KEY = "wf:host-tour-count";
const DISMISSED_KEY = "wf:host-tour-v1"; // legacy: if set, treat as "seen at least once"
const MAX_AUTO_VIEWS = 3;

function readCount(): number {
  if (typeof window === "undefined") return MAX_AUTO_VIEWS;
  try {
    const raw = window.localStorage.getItem(COUNT_KEY);
    if (raw != null) return parseInt(raw, 10) || 0;
    // Migration: if the legacy single-shot key exists, count it as 1 prior view.
    return window.localStorage.getItem(DISMISSED_KEY) ? 1 : 0;
  } catch { return MAX_AUTO_VIEWS; }
}

const STEPS = [
  {
    Icon: Wrench,
    title: "Your host utilities are right here",
    body: "Docs, Board, Drive, Polls — pin whatever your room needs. Everyone in the seat can collaborate.",
  },
  {
    Icon: Rocket,
    title: "Turn it into a Collab when it clicks",
    body: "Tap Create → Create a Collab to fork this live room into a persistent Workshop. Everyone gets a one-tap invite.",
  },
  {
    Icon: Share2,
    title: "Fill the seats",
    body: "Copy the room link and drop it in your DMs or socials. Mutuals already got pinged.",
    cta: "Copy room link",
  },
] as const;

export function HostFirstRunTour({ active }: { active: boolean }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!active) return;
    if (typeof window === "undefined") return;
    if (readCount() >= MAX_AUTO_VIEWS) return;
    const t = window.setTimeout(() => setOpen(true), 600);
    return () => window.clearTimeout(t);
  }, [active]);

  function finish() {
    try {
      const next = readCount() + 1;
      window.localStorage.setItem(COUNT_KEY, String(next));
    } catch { /* ignore */ }
    setOpen(false);
    toast.success("You're hosting. Have fun.");
  }

  function copyLink() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    navigator.clipboard?.writeText(url).then(
      () => toast.success("Link copied"),
      () => toast.error("Couldn't copy link"),
    );
  }

  if (!open) return null;
  const s = STEPS[step];
  const Icon = s.Icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-sm">
      <div className="rounded-2xl border border-border bg-surface p-4 shadow-lift">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet/10 text-violet">
            <RadioTower className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-muted">
              <Icon className="h-3 w-3" /> Host tip · {step + 1} / {STEPS.length}
            </div>
            <h3 className="mt-0.5 font-display text-sm text-ink">{s.title}</h3>
            <p className="mt-1 text-xs text-ink-soft">{s.body}</p>
          </div>
          <button
            type="button"
            onClick={finish}
            aria-label="Dismiss"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-ink-muted hover:bg-muted hover:text-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          {"cta" in s && s.cta && (
            <Button
              size="sm"
              variant="outline"
              onClick={copyLink}
              className="rounded-full gap-1.5 h-7"
            >
              <Share2 className="h-3 w-3" /> {s.cta}
            </Button>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            {!isLast ? (
              <Button size="sm" onClick={() => setStep((i) => Math.min(i + 1, STEPS.length - 1))} className="rounded-full h-7">
                Next
              </Button>
            ) : (
              <Button size="sm" onClick={finish} className="rounded-full gap-1.5 h-7">
                <Check className="h-3 w-3" /> Got it
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

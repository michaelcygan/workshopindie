import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const STEPS: { title: string; body: string }[] = [
  {
    title: "Start with an idea",
    body: "A Collab is a call for collaborators. A title is the only thing you need — everything else can come later.",
  },
  {
    title: "Say where and when",
    body: "Timeline and location are optional signals that help the right people find it. Remote is completely fine.",
  },
  {
    title: "List the roles you need",
    body: "Roles are what make a Collab findable. Pick from the suggestions for your Field, or write your own.",
  },
  {
    title: "Post it and share",
    body: "It goes live as In Progress right away, you get a shareable link, and you can edit anything afterwards.",
  },
];

/**
 * First-run walkthrough for the Collab composer. Shows once per signed-in
 * user, then never again — dismissal persists in localStorage using the same
 * `nudge:` key convention as NudgeCard.
 */
export function CollabComposerWalkthrough() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const storageKey = user ? `nudge:collab-composer-intro:${user.id}` : null;

  useEffect(() => {
    if (!storageKey) return;
    try {
      if (!window.localStorage.getItem(storageKey)) setOpen(true);
    } catch {
      // storage disabled — skip the walkthrough rather than nag every visit
    }
  }, [storageKey]);

  function dismiss() {
    setOpen(false);
    if (!storageKey) return;
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // ignore quota / disabled storage
    }
  }

  if (!open) return null;

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step]!;

  return (
    <Dialog open onOpenChange={(next) => { if (!next) dismiss(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{current.title}</DialogTitle>
          <DialogDescription className="text-base text-ink-muted">{current.body}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <span
              key={s.title}
              className={cn("h-1.5 rounded-full transition-all", i === step ? "w-5 bg-ink" : "w-1.5 bg-border")}
            />
          ))}
        </div>

        <DialogFooter className="mt-2 flex-row items-center justify-between gap-2 sm:justify-between">
          <button
            type="button"
            onClick={dismiss}
            className="text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Skip
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            <Button type="button" onClick={() => (isLast ? dismiss() : setStep((s) => s + 1))}>
              {isLast ? "Start writing" : "Next"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

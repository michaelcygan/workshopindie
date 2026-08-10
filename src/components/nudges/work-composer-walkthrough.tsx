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
    title: "Paste a link, or start blank",
    body: "Drop a link from YouTube, SoundCloud, Vimeo, Bandcamp and more — Workshop pulls in the title, cover and player for you. Prefer to type it all yourself? Start blank.",
  },
  {
    title: "Name it and pick a Field",
    body: "A title and one Field — Music, Film & Video, Writing, and so on — is all a Work needs. Add a Format if you want to be more specific.",
  },
  {
    title: "Add cover, credits and assets",
    body: "Frame the cover, credit the people who made it with you, and attach extra media so the Work presents well everywhere it shows up.",
  },
  {
    title: "Publish and connect it",
    body: "Publishing gives you a shareable page and connects the Work to its Field group automatically. Everything stays editable afterwards.",
  },
];

/**
 * First-run walkthrough for the Work composer. Shows once per signed-in user,
 * then never again — dismissal persists in localStorage using the same
 * `nudge:` key convention as NudgeCard.
 */
export function WorkComposerWalkthrough() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const storageKey = user ? `nudge:work-composer-intro:${user.id}` : null;

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
              {isLast ? "Start a Work" : "Next"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

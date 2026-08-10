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
    title: "Write it like a draft",
    body: "Everything starts private. Nothing is visible to anyone until you publish, so write freely and save whenever you want.",
  },
  {
    title: "Paste links to embed them",
    body: "Drop a URL on its own line and it becomes a visual embed — video, audio, or a link card — right inside the editor. Markdown handles the rest.",
  },
  {
    title: "Set the details",
    body: "Cover image, Field, category and excerpt live in the Details tab. They shape how the post looks on the Blog page and when someone shares it.",
  },
  {
    title: "Publish and connect it",
    body: "Publishing gives you a shareable page, and \u201cAbout this post\u201d lets you link the Works, Collabs or Events behind it. Everything stays editable.",
  },
];

/**
 * First-run walkthrough for the blog composer. Shows once per signed-in user,
 * then never again — dismissal persists in localStorage using the same
 * `nudge:` key convention as NudgeCard.
 */
export function BlogComposerWalkthrough() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const storageKey = user ? `nudge:blog-composer-intro:${user.id}` : null;

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

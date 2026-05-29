import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  hasAvatar: boolean;
  hasHomeCity: boolean;
  hasBio: boolean;
  hasWork: boolean;
  className?: string;
};

const STORAGE_KEY = "profile-completion-dismissed";

export function ProfileCompletionChip({ hasAvatar, hasHomeCity, hasBio, hasWork, className }: Props) {
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash

  useEffect(() => {
    setDismissed(typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  const steps = [
    { key: "avatar", label: "Add a profile photo", done: hasAvatar, to: "/me/edit" as const },
    { key: "city", label: "Set your home city", done: hasHomeCity, to: "/me/edit" as const },
    { key: "bio", label: "Write a short bio", done: hasBio, to: "/me/edit" as const },
    { key: "work", label: "Publish your first Work", done: hasWork, to: "/works/new" as const },
  ];
  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const nextStep = steps.find((s) => !s.done);

  if (completed === total || dismissed || !nextStep) return null;

  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-soft", className)}>
      <div className="flex gap-1">
        {steps.map((s) => (
          <span
            key={s.key}
            className={cn(
              "h-1.5 w-6 rounded-full transition",
              s.done ? "bg-primary" : "bg-muted",
            )}
            aria-hidden
          />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ink">Profile {completed}/{total} — almost there</div>
        <div className="truncate text-xs text-ink-muted">Next: {nextStep.label}</div>
      </div>
      <Link
        to={nextStep.to}
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-background hover:opacity-90"
      >
        Finish <ArrowRight className="h-3 w-3" />
      </Link>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          localStorage.setItem(STORAGE_KEY, "1");
          setDismissed(true);
        }}
        className="shrink-0 rounded-full p-1 text-ink-muted hover:bg-muted hover:text-ink"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

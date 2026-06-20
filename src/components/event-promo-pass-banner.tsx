import { Sparkles } from "lucide-react";

export function EventPromoPassBanner({ months, alreadyPlus }: { months: number; alreadyPlus: boolean }) {
  if (months <= 0) return null;
  return (
    <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-surface to-surface p-5 shadow-soft">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
      <div className="relative flex items-start gap-3">
        <div className="rounded-2xl bg-primary/15 p-2">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="font-display text-base text-ink">
            {alreadyPlus
              ? "You already have Plus — see you there."
              : `RSVP → ${months} month${months === 1 ? "" : "s"} free trial`}
          </div>
          {!alreadyPlus && (
            <p className="mt-1 text-sm text-ink-soft">
              Auto-applied when you mark Going. Unlimited Workshop time, every city, all features.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

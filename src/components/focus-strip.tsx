import { Target } from "lucide-react";

export function FocusStrip({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return (
    <div className="mt-2 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/25 px-3 py-2.5 shadow-soft">
      <div className="flex items-start gap-2">
        <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.14em] text-primary/80 font-medium mb-0.5">
            Focus
          </div>
          <p className="text-sm text-ink leading-snug">{text}</p>
        </div>
      </div>
    </div>
  );
}

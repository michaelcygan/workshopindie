import { Target } from "lucide-react";

export function FocusStrip({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return (
    <div className="mt-2 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
      <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
      <p className="text-sm text-ink leading-snug">{text}</p>
    </div>
  );
}

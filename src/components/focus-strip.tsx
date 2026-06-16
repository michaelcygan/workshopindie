import { Target, Plus } from "lucide-react";

type Props = {
  text: string | null | undefined;
  isHost?: boolean;
  onHostSet?: () => void;
};

export function FocusStrip({ text, isHost, onHostSet }: Props) {
  if (!text) {
    if (!isHost || !onHostSet) return null;
    return (
      <button
        type="button"
        onClick={onHostSet}
        className="mt-2 w-full rounded-xl border border-dashed border-primary/30 bg-primary/[0.03] px-3 py-2 text-left text-xs text-ink-muted hover:bg-primary/[0.06] hover:text-ink transition flex items-center gap-2"
      >
        <Plus className="h-3.5 w-3.5 text-primary/70" />
        Set a focus message — pin a topic everyone sees at the top.
      </button>
    );
  }
  return (
    <div className="mt-2 rounded-xl bg-gradient-to-r from-primary/12 via-primary/6 to-transparent border border-primary/25 px-3 py-2.5 shadow-soft animate-in fade-in slide-in-from-top-1 duration-300 sticky top-2 z-10 backdrop-blur-sm">
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

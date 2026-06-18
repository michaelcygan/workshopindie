import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
};

/** Hairline empty state shaped like the Workshop "You're the spark" hint. */
export function EmptySpark({ title, body, action, className }: Props) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-dashed border-border bg-surface p-10 text-center",
        className,
      )}
    >
      <div className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-4 w-4" />
      </div>
      <h3 className="mt-4 font-display text-xl text-ink md:text-2xl">{title}</h3>
      {body && <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

import * as React from "react";
import { createPortal } from "react-dom";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { FILTER_PILL } from "./index";

/**
 * "More filters" — the sandwich button in the sticky filter bar.
 *
 * Keeps the bar to one line: primary filters stay inline, the overflow set
 * lives in this popover. Shows a count badge whenever something inside is on.
 */
export function FilterMore({
  children,
  activeCount = 0,
  label = "More filters",
  width = 288,
  className,
}: {
  children: React.ReactNode;
  activeCount?: number;
  label?: string;
  width?: number;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [rect, setRect] = React.useState<{ top: number; left: number } | null>(null);
  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const popRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      setRect({
        top: r.bottom + 8,
        left: Math.min(Math.max(8, r.right - width), window.innerWidth - width - 8),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, width]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          FILTER_PILL,
          "inline-flex items-center gap-1.5 whitespace-nowrap",
          activeCount > 0 && "border-transparent bg-ink text-background hover:border-transparent",
          className,
        )}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Filters</span>
        {activeCount > 0 ? (
          <span className="grid h-4 min-w-4 place-items-center rounded-full bg-background px-1 text-[10px] font-semibold text-ink">
            {activeCount}
          </span>
        ) : null}
      </button>

      {open && rect
        ? createPortal(
            <div
              ref={popRef}
              style={{ top: rect.top, left: rect.left, width }}
              className="fixed z-[60] space-y-3 rounded-2xl border border-border bg-surface p-3 shadow-lift"
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** Labeled block inside the popover. */
export function FilterMoreSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
        {title}
      </p>
      {children}
    </div>
  );
}

/** Full-width switch row inside the popover. */
export function FilterMoreToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex w-full items-center justify-between rounded-xl border border-border px-3 py-2 text-left text-[13px] transition",
        active ? "border-transparent bg-ink text-background" : "text-ink-soft hover:bg-muted",
      )}
    >
      {children}
      <span
        className={cn(
          "ml-3 h-4 w-7 shrink-0 rounded-full p-0.5 transition",
          active ? "bg-background/40" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "block h-3 w-3 rounded-full transition",
            active ? "translate-x-3 bg-background" : "bg-ink-muted",
          )}
        />
      </span>
    </button>
  );
}

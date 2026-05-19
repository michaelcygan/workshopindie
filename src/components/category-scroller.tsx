import { useEffect, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export type CategoryTab<T extends string> = { id: T; label: string };

/**
 * Pill-bar of category chips. On mobile it auto-scrolls infinitely and can be
 * dragged. On desktop it renders as a normal wrapping pill row.
 */
export function CategoryScroller<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: CategoryTab<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  const isMobile = useIsMobile();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({ paused: false, dragging: false, startX: 0, startScroll: 0, moved: false });

  useEffect(() => {
    if (!isMobile) return;
    const el = scrollerRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      const s = stateRef.current;
      if (!s.paused && !s.dragging) {
        const half = el.scrollWidth / 2;
        if (half > 0) {
          const pxPerMs = half / 30000;
          let next = el.scrollLeft + pxPerMs * dt;
          if (next >= half) next -= half;
          el.scrollLeft = next;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isMobile]);

  const Chip = ({ t }: { t: CategoryTab<T> }) => (
    <button
      onClick={(e) => {
        if (stateRef.current.moved) {
          e.preventDefault();
          return;
        }
        onChange(t.id);
      }}
      className={cn(
        "shrink-0 rounded-full px-3 py-1.5 text-sm transition select-none",
        value === t.id ? "bg-ink text-background" : "text-ink-soft hover:bg-muted",
      )}
    >
      {t.label}
    </button>
  );

  if (isMobile) {
    return (
      <div
        ref={scrollerRef}
        className={cn(
          "relative overflow-x-auto rounded-full border border-border bg-surface p-1 shadow-soft scrollbar-none touch-pan-x cursor-grab active:cursor-grabbing",
          className,
        )}
        style={{ scrollbarWidth: "none" }}
        onMouseEnter={() => { stateRef.current.paused = true; }}
        onMouseLeave={() => { stateRef.current.paused = false; stateRef.current.dragging = false; }}
        onPointerDown={(e) => {
          const el = scrollerRef.current;
          if (!el) return;
          stateRef.current.dragging = true;
          stateRef.current.moved = false;
          stateRef.current.startX = e.clientX;
          stateRef.current.startScroll = el.scrollLeft;
          el.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const s = stateRef.current;
          if (!s.dragging) return;
          const el = scrollerRef.current;
          if (!el) return;
          const dx = e.clientX - s.startX;
          if (Math.abs(dx) > 4) s.moved = true;
          const half = el.scrollWidth / 2;
          let next = s.startScroll - dx;
          if (half > 0) {
            next = ((next % half) + half) % half;
          }
          el.scrollLeft = next;
        }}
        onPointerUp={(e) => {
          stateRef.current.dragging = false;
          scrollerRef.current?.releasePointerCapture(e.pointerId);
          setTimeout(() => { stateRef.current.moved = false; }, 50);
        }}
        onPointerCancel={() => { stateRef.current.dragging = false; }}
        onTouchStart={() => { stateRef.current.paused = true; }}
        onTouchEnd={() => { stateRef.current.paused = false; }}
      >
        <div className="flex w-max gap-1">
          {[...tabs, ...tabs].map((t, i) => (
            <Chip key={`${t.id}-${i}`} t={t} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-1 rounded-full border border-border bg-surface p-1 shadow-soft", className)}>
      {tabs.map((t) => <Chip key={t.id} t={t} />)}
    </div>
  );
}

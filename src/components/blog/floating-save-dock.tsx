import { useEffect, useRef, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Desktop-only Save pill that lives in the right-hand gutter of the composer.
 *
 * It exists only to cover the stretch of scroll where no real Save button is
 * on screen: it fades in once both the header row and the footer row have left
 * the viewport, and fades back out the moment either returns.
 */
export function FloatingSaveDock({
  anchors,
  onSave,
  disabled,
  saving,
  status,
}: {
  /** The action rows that already contain a Save button. */
  anchors: Array<RefObject<HTMLElement | null>>;
  onSave: () => void;
  disabled?: boolean;
  saving?: boolean;
  status?: string | null;
}) {
  const visible = useAnchorsOffscreen(anchors);

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        "pointer-events-none fixed right-6 top-[42vh] z-30 hidden flex-col items-end gap-1.5 transition-opacity duration-150 motion-reduce:transition-none lg:flex",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <Button
        type="button"
        onClick={onSave}
        disabled={disabled}
        tabIndex={visible ? 0 : -1}
        className={cn(
          "h-11 rounded-full px-6 shadow-lg shadow-black/10",
          visible && "pointer-events-auto",
        )}
      >
        {saving ? "Saving…" : "Save"}
      </Button>
      {status && (
        <span className="rounded-full bg-background/90 px-2 py-0.5 text-[11px] text-ink-muted">
          {status}
        </span>
      )}
    </div>
  );
}

/** True when none of the given elements are currently in the viewport. */
function useAnchorsOffscreen(anchors: Array<RefObject<HTMLElement | null>>) {
  const [offscreen, setOffscreen] = useState(false);
  const seen = useRef(new Map<Element, boolean>());

  useEffect(() => {
    const els = anchors.map((r) => r.current).filter((el): el is HTMLElement => !!el);
    if (els.length === 0) return;
    seen.current = new Map(els.map((el) => [el, false]));

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) seen.current.set(e.target, e.isIntersecting);
      setOffscreen(![...seen.current.values()].some(Boolean));
    });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // Anchors are stable refs owned by the editor route.
  }, [anchors]);

  return offscreen;
}

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type HintTarget = "publish" | "collab" | "instant";

export function FirstRunHint() {
  const [target, setTarget] = useState<HintTarget | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    let raw: string | null = null;
    try { raw = sessionStorage.getItem("ws.first_run_hint"); } catch { /* ignore */ }
    if (raw !== "publish" && raw !== "collab" && raw !== "instant") return;
    setTarget(raw);

    const clear = () => {
      try { sessionStorage.removeItem("ws.first_run_hint"); } catch { /* ignore */ }
      setTarget(null);
      setRect(null);
    };

    // Wait for header to render, then find the target
    const find = () => {
      const el = document.querySelector<HTMLElement>(`[data-firstrun="${raw}"]`);
      if (!el) return false;
      setRect(el.getBoundingClientRect());
      el.addEventListener("click", clear, { once: true });
      return true;
    };

    let tries = 0;
    const interval = window.setInterval(() => {
      if (find() || tries++ > 20) window.clearInterval(interval);
    }, 100);

    const onResize = () => {
      const el = document.querySelector<HTMLElement>(`[data-firstrun="${raw}"]`);
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);

    const timeout = window.setTimeout(clear, 12000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, []);

  if (!target || !rect || typeof document === "undefined") return null;

  const top = rect.top + rect.height / 2 - 6;
  const left = rect.right - 6;

  return createPortal(
    <div
      className="pointer-events-none fixed z-[60]"
      style={{ top, left }}
      aria-hidden
    >
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-primary ring-2 ring-background" />
      </span>
    </div>,
    document.body,
  );
}

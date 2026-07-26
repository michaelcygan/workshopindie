import { useEffect, useState } from "react";

/**
 * True when the virtual keyboard is (likely) covering the viewport.
 * Uses visualViewport where available; falls back to focusin/out on editable fields.
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const vv = window.visualViewport;
    if (vv) {
      const check = () => {
        // If visual viewport is meaningfully shorter than the layout viewport,
        // the on-screen keyboard is up.
        setOpen(vv.height < window.innerHeight * 0.85);
      };
      check();
      vv.addEventListener("resize", check);
      vv.addEventListener("scroll", check);
      return () => {
        vv.removeEventListener("resize", check);
        vv.removeEventListener("scroll", check);
      };
    }

    // Fallback: focus on an editable element.
    const isEditable = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el.isContentEditable
      );
    };
    const onFocusIn = (e: FocusEvent) => {
      if (isEditable(e.target)) setOpen(true);
    };
    const onFocusOut = () => setOpen(false);
    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("focusout", onFocusOut);
    return () => {
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return open;
}

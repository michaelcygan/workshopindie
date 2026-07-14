import { useEffect, type RefObject } from "react";

/**
 * Pause a `<video>` element's decode when it scrolls off-screen or its tile
 * is otherwise hidden, resume it when it comes back. Mesh receive continues
 * either way — this only stops the browser from decoding frames the user
 * can't see, which on Chromium accounts for meaningful CPU at 5 peers.
 *
 * Safe to call for elements whose `srcObject` isn't set yet — the observer
 * simply toggles play state when the browser has something to decode.
 */
export function useVisibleVideo(ref: RefObject<HTMLVideoElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let visible = true;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const next = entry.isIntersecting;
        if (next === visible) return;
        visible = next;
        if (next) {
          el.play().catch(() => { /* autoplay policies — noop */ });
        } else {
          try { el.pause(); } catch { /* noop */ }
        }
      },
      { threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
}

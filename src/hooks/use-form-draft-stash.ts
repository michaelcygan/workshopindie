import { useEffect, useRef } from "react";

/**
 * Mirrors a form's in-progress values into sessionStorage so navigating away
 * (e.g. tapping the mobile composer "+") doesn't lose typed work.
 *
 * Usage:
 *   const stash = useFormDraftStash("works-new", { title, description }, (v) => {
 *     if (v.title) setTitle(v.title);
 *   });
 *   // on submit success / explicit cancel:
 *   stash.clear();
 */
export function useFormDraftStash<T extends Record<string, unknown>>(
  key: string,
  value: T,
  restore: (value: Partial<T>) => void,
) {
  const storageKey = `workshop:draft:${key}`;
  const restored = useRef(false);
  const cleared = useRef(false);

  // Restore once on mount.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<T>;
      if (parsed && typeof parsed === "object") restore(parsed);
    } catch {
      /* ignore corrupt stash */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Persist on change (after the initial restore pass).
  useEffect(() => {
    if (!restored.current || cleared.current) return;
    if (typeof window === "undefined") return;
    const hasContent = Object.values(value).some((v) =>
      typeof v === "string" ? v.trim().length > 0 : Array.isArray(v) ? v.length > 0 : v != null && v !== false,
    );
    try {
      if (hasContent) window.sessionStorage.setItem(storageKey, JSON.stringify(value));
      else window.sessionStorage.removeItem(storageKey);
    } catch {
      /* storage full or unavailable */
    }
  }, [storageKey, value]);

  return {
    clear() {
      cleared.current = true;
      if (typeof window === "undefined") return;
      try {
        window.sessionStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    },
  };
}

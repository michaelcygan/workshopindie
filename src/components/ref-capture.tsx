import { useEffect } from "react";

const REF_KEY = "signup-ref";

/** Captures ?ref=<username> from any URL into sessionStorage so referral
 * attribution survives an OAuth round-trip (Google) and lands at onboarding. */
export function RefCapture() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref && /^[a-z0-9_.]{1,30}$/i.test(ref)) {
      try { sessionStorage.setItem(REF_KEY, ref.toLowerCase()); } catch { /* ignore */ }
    }
  }, []);
  return null;
}

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Sign-in providers redirect back to the app with ?error=/#error= params when
 * the hand-off fails. Without this the user just lands on the homepage as if
 * nothing happened. Surface it, then strip the params from the URL.
 */
export function OAuthErrorToast() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    const error = url.searchParams.get("error") ?? hash.get("error");
    if (!error) return;
    const description =
      url.searchParams.get("error_description") ??
      hash.get("error_description") ??
      "Sign-in didn't complete. Please try again.";

    toast.error("Sign-in failed", {
      description: decodeURIComponent(description.replace(/\+/g, " ")),
      duration: 10000,
    });

    for (const key of ["error", "error_code", "error_description"]) {
      url.searchParams.delete(key);
      hash.delete(key);
    }
    const rest = hash.toString();
    url.hash = rest ? `#${rest}` : "";
    window.history.replaceState({}, "", url.toString());
  }, []);

  return null;
}

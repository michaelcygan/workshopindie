/**
 * Google Analytics 4 initialization for Workshop.
 *
 * This is a frontend-only integration: gtag.js loads from Google once the app
 * hydrates. The Measurement ID comes from the connected Lovable Google
 * Analytics connector as VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY.
 *
 * No IP, no user id, no PII — event parameters are limited to route and
 * action metadata.
 */

export const GA_MEASUREMENT_ID = import.meta.env
  .VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY as string | undefined;

export type GtagEventName =
  | "page_view"
  | "sign_up"
  | "login"
  | "begin_checkout"
  | "purchase"
  | "submit_application"
  | "share"
  | "select_content"
  | "search";

export type GtagEventParams = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * The gtag.js snippet is now server-rendered into <head> from
 * src/routes/__root.tsx, exactly as Google publishes it, so Google's
 * "tag detected" check and Tag Assistant can see it in the page source.
 *
 * This function stays as a no-op safety net for older call sites and for the
 * rare case where the head script was stripped (extension/ad blocker).
 */
export function initGoogleAnalytics(): void {
  if (typeof document === "undefined") return;
  if (!GA_MEASUREMENT_ID) return;
  if (window.gtag) return;
  if (document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function (...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID);
}


/** Send a GA4 event. No-ops if GA is not configured or not yet initialized. */
export function gtagEvent(name: GtagEventName, params: GtagEventParams = {}): void {
  if (typeof window === "undefined" || !window.gtag) return;

  const cleaned: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      cleaned[key] = value;
    }
  }

  window.gtag("event", name, cleaned);
}

/** Convenience for page_view events in the SPA. */
export function gtagPageView(path: string, title?: string): void {
  gtagEvent("page_view", {
    page_path: path,
    page_title: title ?? path,
    page_location: typeof window !== "undefined" ? `${window.location.origin}${path}` : undefined,
  });
}

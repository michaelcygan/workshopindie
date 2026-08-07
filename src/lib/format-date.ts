/**
 * SSR-stable date formatting.
 *
 * These strings are rendered on the server and then hydrated in the browser.
 * `toLocaleDateString` with no arguments resolves the locale AND the time zone
 * from the runtime, so the server (UTC) and a viewer in Chicago disagree about
 * which calendar day an evening publish time falls on — React then throws a
 * hydration mismatch. Pinning both makes the two renders identical.
 *
 * Publish dates are editorial datelines, not personal timestamps, so a fixed
 * zone is also the correct product behaviour: everyone sees the same date on a
 * post. For genuinely viewer-relative times (a message clock, an event start),
 * format on the client after mount instead of using these helpers.
 */

const LOCALE = "en-US";
const ZONE = "UTC";

/** e.g. "August 2, 2026" */
export function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(LOCALE, {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: ZONE,
  });
}

/** e.g. "Aug 2, 2026" */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(LOCALE, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: ZONE,
  });
}

/** e.g. "Aug 2" — used where the year is implied by context. */
export function formatDayMonth(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(LOCALE, { month: "short", day: "numeric", timeZone: ZONE });
}

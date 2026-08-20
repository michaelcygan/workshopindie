/**
 * Workshop is an 18+ platform. We don't collect birthdays — members confirm
 * once with a checkbox, and the server stamps `profiles.adult_attested_at`.
 *
 * A signup surface can't always write that stamp immediately (email confirm
 * and OAuth both round-trip away first), so the checkbox is remembered locally
 * and the account-lifecycle provider stamps it as soon as a session exists.
 * The first-run gate is still the backstop if the flag never survives.
 */
const KEY = "workshop.adult_attested";

export function rememberAdultAttestation() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, "1");
    window.localStorage.setItem(KEY, "1");
  } catch {
    /* storage disabled — the first-run gate handles it */
  }
}

export function hasPendingAdultAttestation(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.sessionStorage.getItem(KEY) === "1" || window.localStorage.getItem(KEY) === "1"
    );
  } catch {
    return false;
  }
}

export function clearPendingAdultAttestation() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
    window.localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

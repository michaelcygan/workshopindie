/**
 * One-shot handoff of a typed password between /login and /signup so a person
 * bounced across flows doesn't have to retype it.
 */
const KEY = "auth-handoff-password";

export function stashHandoffPassword(password: string) {
  if (typeof window === "undefined" || !password) return;
  try {
    sessionStorage.setItem(KEY, password);
  } catch {
    /* ignore */
  }
}

export function takeHandoffPassword(): string {
  if (typeof window === "undefined") return "";
  try {
    const v = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return v ?? "";
  } catch {
    return "";
  }
}

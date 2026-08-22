/**
 * Pure state helpers for the logged-out "Join Workshop" prompt.
 *
 * The prompt shows at most once per 7-day window. After the window lapses the
 * visitor is treated as a first-time visitor again.
 */

export const JOIN_PROMPT_STORAGE_KEY = "ws.join_prompt_snooze_until";
export const JOIN_PROMPT_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

/** Timestamp (ms) until which the prompt stays hidden. */
export function snoozeUntil(now: number): number {
  return now + JOIN_PROMPT_SNOOZE_MS;
}

/**
 * `stored` is the raw localStorage value (may be null/garbage).
 * Unparseable values are treated as "never seen" so a bad write can't
 * permanently suppress the prompt.
 */
export function shouldShowJoinPrompt(now: number, stored: string | null): boolean {
  if (!stored) return true;
  const until = Number.parseInt(stored, 10);
  if (!Number.isFinite(until)) return true;
  return now >= until;
}

export function readSnooze(): string | null {
  try {
    return localStorage.getItem(JOIN_PROMPT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeSnooze(now: number): void {
  try {
    localStorage.setItem(JOIN_PROMPT_STORAGE_KEY, String(snoozeUntil(now)));
  } catch {
    /* private mode — prompt simply reappears next session */
  }
}

/**
 * The prompt only appears where Workshop is introducing itself: the homepage
 * and Events. Member profiles, Works, Blog, Groups and Collabs are never
 * advertised over.
 */
const ALLOWED_PREFIXES = ["/events", "/e"];

export function isJoinPromptAllowedPath(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path === "/" || path === "") return true;
  if (/^\/g\/[^/]+\/e\/[^/]+$/.test(path)) return true;
  return ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
}

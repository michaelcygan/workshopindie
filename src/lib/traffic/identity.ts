import {
  TRAFFIC_ENDPOINT,
  TRAFFIC_LIVE_ENDPOINT,
  TRAFFIC_SESSION_KEY,
  TRAFFIC_SESSION_TIMEOUT_MS,
  TRAFFIC_VISITOR_KEY,
} from "./shared";

/**
 * Anonymous first-party identity for traffic measurement.
 *
 * `visitor_id` identifies one browser installation, not one human: the same
 * person on a phone and a laptop is two visitors, and that is fine. We never
 * fingerprint to merge them. `session_id` is a visit, rotated after 30 minutes
 * of inactivity. Both live only in this origin's own storage, and every
 * storage access degrades to memory rather than throwing.
 */

let memoryVisitor: string | null = null;
let memorySession: { id: string; last: number } | null = null;

function uuid(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  // Non-secure contexts still need a well-formed, collision-unlikely id.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode / storage disabled — memory fallback covers the tab */
  }
}

export function getVisitorId(): string {
  const stored = read(TRAFFIC_VISITOR_KEY);
  if (stored && UUID_RE.test(stored)) return stored;
  if (!memoryVisitor) memoryVisitor = uuid();
  write(TRAFFIC_VISITOR_KEY, memoryVisitor);
  return memoryVisitor;
}

/** Current visit, rolling over after 30 minutes of inactivity. */
export function getSessionId(now = Date.now()): string {
  let current = memorySession;
  if (!current) {
    const raw = read(TRAFFIC_SESSION_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { id?: unknown; last?: unknown };
        if (typeof parsed.id === "string" && UUID_RE.test(parsed.id) && typeof parsed.last === "number") {
          current = { id: parsed.id, last: parsed.last };
        }
      } catch {
        current = null;
      }
    }
  }

  const fresh = current && now - current.last < TRAFFIC_SESSION_TIMEOUT_MS;
  const next = fresh ? { id: current!.id, last: now } : { id: uuid(), last: now };
  memorySession = next;
  write(TRAFFIC_SESSION_KEY, JSON.stringify(next));
  return next.id;
}

export type PageviewPayload = {
  visitorId: string;
  sessionId: string;
  path: string;
  routePattern: string | null;
  visitorType: "guest" | "member";
  referrerHost: string | null;
};

/** Fire and forget. Navigation never waits on measurement, and never fails on it. */
function send(endpoint: string, payload: unknown): void {
  const body = JSON.stringify(payload);
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(endpoint, blob)) return;
    }
  } catch {
    /* fall through to fetch */
  }
  try {
    void fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "omit",
    }).catch(() => {});
  } catch {
    /* measurement is optional */
  }
}

export function sendPageview(payload: PageviewPayload): void {
  send(TRAFFIC_ENDPOINT, payload);
}

export type LiveHeartbeatPayload = {
  sessionId: string;
  path: string;
  visitorType: "guest" | "member";
  source: string | null;
};

/** "This tab is visible, on this page." Same fire-and-forget contract. */
export function sendLiveHeartbeat(payload: LiveHeartbeatPayload): void {
  send(TRAFFIC_LIVE_ENDPOINT, payload);
}

/** External referring host for the session entry, hostname only. */
export function documentReferrerHost(): string | null {
  try {
    if (!document.referrer) return null;
    const host = new URL(document.referrer).hostname.toLowerCase();
    if (!host || host === window.location.hostname.toLowerCase()) return null;
    return host.slice(0, 120);
  } catch {
    return null;
  }
}

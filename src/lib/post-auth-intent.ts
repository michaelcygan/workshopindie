/**
 * Versioned, tab-scoped post-auth intent.
 *
 * When a signed-out visitor tries to RSVP / follow / join / like / claim, the
 * action is persisted here BEFORE authentication starts, so it survives a full
 * Google/Apple redirect or an email-confirmation round trip. It is consumed
 * only once the account lifecycle reaches `ready` — never on bare SIGNED_IN.
 *
 * sessionStorage (not localStorage): the intent belongs to this tab and this
 * auth round trip. No tokens, no birthdates, no personal data.
 */
import { safeDestination } from "./safe-destination";
import { workshopEntityUrl } from "@/lib/entities/kinds";

export const INTENT_KEY = "ws.postAuthIntent.v1";
const VERSION = 1;
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

export type PostAuthIntentKind =
  | "return_to"
  | "event_rsvp"
  | "group_seed_join"
  | "group_join"
  | "follow_user"
  | "like_work"
  | "save_work"
  | "workshop_invite"
  | "collab_claim"
  | "referral";

export type PostAuthIntent = {
  v: number;
  kind: PostAuthIntentKind;
  payload: Record<string, string>;
  /** Same-origin path to land on after the intent runs. */
  returnTo: string;
  createdAt: number;
  expiresAt: number;
};

export type NewPostAuthIntent = {
  kind: PostAuthIntentKind;
  payload?: Record<string, string>;
  returnTo?: string | null;
  ttlMs?: number;
};

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function serializeIntent(intent: NewPostAuthIntent, now = Date.now()): PostAuthIntent {
  return {
    v: VERSION,
    kind: intent.kind,
    payload: intent.payload ?? {},
    returnTo: safeDestination(intent.returnTo) ?? "/",
    createdAt: now,
    expiresAt: now + (intent.ttlMs ?? DEFAULT_TTL_MS),
  };
}

/** Parse + validate a stored intent. Returns null for anything untrustworthy. */
export function parseIntent(raw: string | null, now = Date.now()): PostAuthIntent | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const i = parsed as Partial<PostAuthIntent>;
  if (i.v !== VERSION) return null;
  if (typeof i.kind !== "string") return null;
  if (typeof i.expiresAt !== "number" || i.expiresAt <= now) return null;
  if (i.payload && typeof i.payload !== "object") return null;
  const returnTo = safeDestination(i.returnTo);
  if (!returnTo) return null;
  return {
    v: VERSION,
    kind: i.kind as PostAuthIntentKind,
    payload: (i.payload as Record<string, string>) ?? {},
    returnTo,
    createdAt: typeof i.createdAt === "number" ? i.createdAt : now,
    expiresAt: i.expiresAt,
  };
}

/** Persist an intent before starting authentication. */
export function setPostAuthIntent(intent: NewPostAuthIntent) {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(INTENT_KEY, JSON.stringify(serializeIntent(intent)));
  } catch {
    /* storage full / disabled — the auth flow still works, just without resume */
  }
}

/** Read without consuming. */
export function peekPostAuthIntent(): PostAuthIntent | null {
  const s = storage();
  if (!s) return null;
  const intent = parseIntent(s.getItem(INTENT_KEY));
  if (!intent) clearPostAuthIntent();
  return intent;
}

export function clearPostAuthIntent() {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(INTENT_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Migrate the pre-existing one-off keys into the unified intent so pending
 * values created before this build aren't silently dropped.
 */
export function migrateLegacyIntents() {
  const s = storage();
  if (!s) return;
  if (s.getItem(INTENT_KEY)) return;

  try {
    const seed = s.getItem("ws.pendingGroupJoin");
    if (seed) {
      const parsed = JSON.parse(seed) as { token?: string; slug?: string };
      s.removeItem("ws.pendingGroupJoin");
      if (parsed?.token && parsed?.slug) {
        setPostAuthIntent({
          kind: "group_seed_join",
          payload: { token: parsed.token, slug: parsed.slug },
          returnTo: workshopEntityUrl({ kind: "group", slug: parsed.slug }),
        });
        return;
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const rsvp = s.getItem("workshop:pending_rsvp");
    if (rsvp) {
      const parsed = JSON.parse(rsvp) as {
        event_id?: string;
        status?: string;
        redirect_to?: string;
      };
      s.removeItem("workshop:pending_rsvp");
      if (parsed?.event_id && parsed?.status) {
        setPostAuthIntent({
          kind: "event_rsvp",
          payload: { event_id: parsed.event_id, status: parsed.status },
          returnTo: parsed.redirect_to ?? "/",
        });
      }
    }
  } catch {
    /* ignore */
  }
}

/**
 * Run an intent exactly once for one user. Safe under React Strict Mode and
 * duplicate SIGNED_IN events: the in-flight guard is keyed by user + intent.
 */
const inFlight = new Set<string>();

export async function consumePostAuthIntent(
  userId: string,
  run: (intent: PostAuthIntent) => Promise<void>,
): Promise<PostAuthIntent | null> {
  const intent = peekPostAuthIntent();
  if (!intent) return null;
  const guard = `${userId}:${intent.kind}:${intent.createdAt}`;
  if (inFlight.has(guard)) return null;
  inFlight.add(guard);
  try {
    await run(intent);
    clearPostAuthIntent();
    return intent;
  } catch (err) {
    // Recoverable failure: keep the intent so the user can retry.
    throw err;
  } finally {
    inFlight.delete(guard);
  }
}

/** Test hook. */
export function __resetIntentGuards() {
  inFlight.clear();
}
